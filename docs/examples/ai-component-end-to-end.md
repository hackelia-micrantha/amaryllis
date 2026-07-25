# End-to-end AI component example

> **Experimental:** `amaryllis/v1alpha1` and `@micrantha/amaryllis-components` are experimental APIs. They are not stable public contracts and may change before release.

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
- [`summary-card.personalization.schema.json`](./summary-card.personalization.schema.json): generated personalization contract for this spec

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

The checked-in [`summary-card.personalization.schema.json`](./summary-card.personalization.schema.json) is the readable generated form of this contract and must remain aligned with the CLI output.

Apply a reviewed customization patch and regenerate:

```sh
node packages/amaryllis-components/dist/cli/index.js customize \
  --spec docs/examples/summary-card.component.yaml \
  --patch docs/examples/summary-card.customization.patch.json \
  --output /tmp/SummaryCard.customized.tsx
```

Generated TSX is a build or CI artifact, not runtime model output. Treat it like source code: inspect the diff, run lint, type checking, and tests, enforce allowed imports, and require human review before promotion.

## Runtime personalization flow

For provider-free Node or CI verification, import only the built modules exercised by the example. Importing the package barrel also loads React Native runtime primitives and is intended for React Native application code, not plain Node execution.

```js
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const distRoot = path.resolve('packages/amaryllis-components/dist');

const { ComponentRegistry } = require(
  path.join(distRoot, 'runtime/registry.js')
);
const { PersonalizationEngine } = require(
  path.join(distRoot, 'runtime/engine.js')
);
const { JSONSchemaGenerator } = require(
  path.join(distRoot, 'generator/schema.js')
);
const { parseComponentSpec } = require(
  path.join(distRoot, 'parser/yaml.js')
);

const spec = parseComponentSpec(
  fs.readFileSync('docs/examples/summary-card.component.yaml', 'utf8')
);
const generatedContract = JSON.parse(
  new JSONSchemaGenerator().generate(spec)
);

const registry = new ComponentRegistry();
const SummaryCard = () => null;

registry.register('summary-card', {
  component: SummaryCard,
  spec,
  contract: generatedContract,
  implementationIdentity: 'app/components/SummaryCard',
});

const registered = registry.get('summary-card');
if (!registered) {
  throw new Error('summary-card was not registered');
}

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
const result = engine.validate(registered.contract, structuredOutput);
const personalizedProps = result.valid
  ? engine.apply(baseProps, result.data ?? {})
  : baseProps;

const ApprovedSummaryCard = registered.component;
```

The demonstrated authority path is now explicit:

```text
untrusted structured output
  -> registered contract validation
  -> bounded props overlay
  -> registry-approved component implementation
```

`ApprovedSummaryCard`, `registered.spec`, and `registered.contract` all come from the same registry entry. Valid output is merged over base props only after validation against the bound contract. Runtime JSX, TSX, JavaScript, imports, event handlers, and native operations are outside this contract.

## Invalid-output fallback

Use the invalid fixture to prove the fail-closed behavior through the same registered contract:

```js
const invalidOutput = JSON.parse(
  fs.readFileSync(
    'docs/examples/summary-card.personalization.invalid.json',
    'utf8'
  )
);

const invalidResult = engine.validate(registered.contract, invalidOutput);
const fallbackProps = invalidResult.valid
  ? engine.apply(baseProps, invalidResult.data ?? {})
  : baseProps;
```

`fallbackProps` remains exactly equal to `baseProps`. Invalid output is rejected as a whole and does not partially mutate component state.

In React Native application code, consumers may use the package barrel and registry-backed rendering primitives because the React Native runtime is present. The provider-free Node example above intentionally mirrors the CI verifier and avoids loading platform primitives.

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

The verifier uses the package's actual parser, policy path, generators, registry, and personalization engine. It executes all three CLI commands, compares the generated contract to the runtime contract, validates the valid fixture through the registered entry, rejects the invalid fixture, and asserts fallback to base props. CI performs the same operations after component tests, lint, type checking, and build.

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
