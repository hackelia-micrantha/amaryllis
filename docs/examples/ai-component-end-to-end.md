# End-to-end AI component example

> **Experimental:** `amaryllis/v1alpha1` and `@micrantha/amaryllis-components` are branch-level experimental APIs. They are not stable public contracts and may change before release.

This example exercises the governed path from a reviewed component spec to generated artifacts and structured runtime personalization. It is offline-first and does not require a live model provider.

```text
ComponentSpec YAML
  -> schema validation
  -> policy validation
  -> contract generation
  -> React Native component generation or bounded customization
  -> registry binding
  -> structured runtime personalization
  -> deterministic fallback for invalid output
```

## Package boundary

- `@micrantha/react-native-amaryllis` is the React Native inference substrate. It owns native model execution, streaming, model inputs, and the application-facing inference APIs.
- `@micrantha/amaryllis-components` is the experimental companion package. It owns `ComponentSpec`, schema and policy validation, build-time React generation, registry identity, personalization contracts, and structured overlay validation.

The companion package does not execute a model and does not replace the base runtime. Applications may obtain structured output from the base runtime, a remote service, a test fixture, or another provider-neutral inference function, then pass that untrusted data through the companion package validators.

The model never becomes the direct source of executable runtime UI.

## Files

- [`summary-card.component.yaml`](./summary-card.component.yaml): authoritative React Native component spec
- [`summary-card.customization.patch.json`](./summary-card.customization.patch.json): reviewed build-time JSON Patch
- [`summary-card.personalization.valid.json`](./summary-card.personalization.valid.json): valid structured runtime output
- [`summary-card.personalization.invalid.json`](./summary-card.personalization.invalid.json): invalid runtime output that must fall back
- [`summary-card.personalization.schema.json`](./summary-card.personalization.schema.json): readable example of the personalization contract

## Build-time CLI flow

Build the companion package before running its CLI:

```sh
yarn install --immutable
yarn workspace @micrantha/amaryllis-components build
```

Generate reviewed TSX from the authoritative spec:

```sh
node packages/amaryllis-components/dist/cli/index.js generate \
  --spec docs/examples/summary-card.component.yaml \
  --output /tmp/SummaryCard.tsx
```

The CLI performs schema and policy validation before writing output. The canonical spec name is `summary-card`; the generator converts it to the React component identifier `SummaryCard`.

Generate the structured runtime contract:

```sh
node packages/amaryllis-components/dist/cli/index.js contract \
  --spec docs/examples/summary-card.component.yaml \
  > /tmp/SummaryCard.contract.json
```

Apply a reviewed customization patch and regenerate:

```sh
node packages/amaryllis-components/dist/cli/index.js customize \
  --spec docs/examples/summary-card.component.yaml \
  --patch docs/examples/summary-card.customization.patch.json \
  --output /tmp/SummaryCard.customized.tsx
```

Generated TSX is a build or CI artifact, not runtime model output. Treat it like source code: inspect the diff, run lint, type checking, and tests, enforce allowed imports, and require human review before promotion.

## Runtime personalization flow

Register an approved implementation with its validated spec and generated contract. The registry identity must exactly match `spec.metadata.name`:

```ts
import fs from 'node:fs';
import {
  ComponentRegistry,
  JSONSchemaGenerator,
  PersonalizationEngine,
  parseComponentSpec,
} from '@micrantha/amaryllis-components';

const spec = parseComponentSpec(
  fs.readFileSync('docs/examples/summary-card.component.yaml', 'utf8')
);
const contract = JSON.parse(new JSONSchemaGenerator().generate(spec));

const registry = new ComponentRegistry();
const SummaryCard = () => null;

registry.register('summary-card', {
  component: SummaryCard,
  spec,
  contract,
  implementationIdentity: 'app/components/SummaryCard',
});

const baseProps = {
  title: 'Base title',
  summary: 'Base summary',
  variant: 'expanded',
};

const structuredOutput = JSON.parse(
  fs.readFileSync(
    'docs/examples/summary-card.personalization.valid.json',
    'utf8'
  )
);

const engine = new PersonalizationEngine();
const result = engine.validate(contract, structuredOutput);
const personalizedProps = result.valid
  ? engine.apply(baseProps, result.data ?? {})
  : baseProps;
```

```text
untrusted structured output
  -> JSON Schema validation
  -> unsafe-value and patch validation
  -> bounded props overlay
  -> approved registered component
```

Valid output is merged over base props only after validation. Runtime JSX, TSX, JavaScript, imports, event handlers, and native operations are outside this contract.

## Invalid-output fallback

Use the invalid fixture to prove the fail-closed behavior:

```ts
const invalidOutput = JSON.parse(
  fs.readFileSync(
    'docs/examples/summary-card.personalization.invalid.json',
    'utf8'
  )
);

const invalidResult = engine.validate(contract, invalidOutput);
const fallbackProps = invalidResult.valid
  ? engine.apply(baseProps, invalidResult.data ?? {})
  : baseProps;
```

`fallbackProps` remains exactly equal to `baseProps`. Invalid output is rejected as a whole and does not partially mutate component state.

## Automated verification

Run the provider-free verification from the repository root:

```sh
yarn verify:component-examples
```

Or run the workspace verifier after building:

```sh
yarn workspace @micrantha/amaryllis-components build
yarn workspace @micrantha/amaryllis-components verify:examples
```

The verifier uses the package's actual parser, policy path, generators, registry, and personalization engine. It executes all three CLI commands, validates the valid fixture, rejects the invalid fixture, and asserts fallback to base props. CI performs the same operations after component tests, lint, type checking, and build.

## Security notes

### Prompt injection

Treat prompts, retrieved text, tool results, and model output as untrusted input. Prompt delimiters and instructions can reduce accidental mixing but are not authorization boundaries. The schema, policy engine, registry, and runtime validator remain authoritative.

### Unsafe generated code

Executable TSX generation is limited to build or CI workflows and must be review-gated. Never evaluate model-produced JavaScript or accept unrestricted imports. Generated artifacts require the same static analysis, tests, provenance checks, and code review as handwritten source.

### Structured-output validation

Runtime personalization is structured-data-only. Reject data that does not match the generated contract, references undeclared variants or paths, includes unsafe object keys, or attempts to carry executable values. Validation failure must not partially apply output.

### Registry authority

The registry binds a canonical spec identity and version to a reviewed implementation and runtime contract. Model output must not select arbitrary modules, rename registry identities, or bypass implementation binding.

### Telemetry and input minimization

Collect validation outcomes, contract or spec identifiers, bounded operation types, and coarse diagnostics rather than raw prompts, user content, images, secrets, or full model output by default. Define retention and access controls before enabling diagnostic capture.

### Fail closed

On parse, schema, policy, registry, or contract-validation failure:

- reject the personalization output
- preserve the last trusted or base props
- surface a bounded diagnostic
- never fall back to executing raw output

## Current limitations

This example proves the contract, generation, registry, and fallback path. It does not establish production readiness. The experimental package still requires versioning discipline, compatibility guarantees, release hardening, and broader consumer validation before its API can be considered stable.
