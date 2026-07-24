# End-to-end AI component example

> **Experimental:** `amaryllis/v1alpha1` and `@micrantha/amaryllis-components` are branch-level experimental APIs. They are not stable public contracts and may change before release.

This example exercises the governed path from a reviewed component spec to generated artifacts and structured runtime personalization. It is offline-first and does not require a model provider.

## Package boundary

- `@micrantha/react-native-amaryllis` is the React Native inference substrate. It owns native model execution and the application-facing inference APIs.
- `@micrantha/amaryllis-components` is the experimental companion package. It owns `ComponentSpec`, schema and policy validation, build-time React generation, registry identity, personalization contracts, and structured overlay validation.

The companion package does not execute a model and does not replace the base runtime. Applications may obtain structured output from the base runtime, a remote service, a test fixture, or another provider-neutral inference function, then pass that untrusted data through the companion package validators.

## Files

- [`summary-card.component.yaml`](./summary-card.component.yaml): authoritative component spec
- [`summary-card.customization.patch.json`](./summary-card.customization.patch.json): reviewed build-time JSON Patch
- [`summary-card.personalization.valid.json`](./summary-card.personalization.valid.json): valid structured runtime output
- [`summary-card.personalization.invalid.json`](./summary-card.personalization.invalid.json): invalid runtime output that must fall back
- [`runtime-summary-card.tsx`](./runtime-summary-card.tsx): registration and rendering example

## Build-time CLI flow

Build the companion package before running its CLI:

```sh
yarn workspace @micrantha/amaryllis-components build
```

Generate reviewed TSX from the authoritative spec:

```sh
node packages/amaryllis-components/dist/cli/index.js generate \
  --spec docs/examples/summary-card.component.yaml \
  --output /tmp/SummaryCard.tsx
```

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

Generated TSX is a build/CI artifact, not runtime model output. Treat it like source code: inspect the diff, run lint/typecheck/tests, enforce allowed imports, and require human review before promotion.

## Runtime personalization flow

The runtime example registers an approved component implementation with its validated spec and generated contract. The model-facing boundary accepts only structured data:

```text
untrusted structured output
  -> JSON Schema validation
  -> unsafe-value and patch validation
  -> bounded props overlay
  -> approved registered component
```

Valid output is merged over base props. Invalid output is rejected and the component deterministically renders its original base props. Runtime JSX, TSX, JavaScript, imports, and native operations are outside this contract.

## Automated verification

Run the same provider-free verification used by CI:

```sh
yarn verify:component-examples
```

The verifier builds on the package's actual parser, policy engine, generators, registry, and personalization engine. It executes all three CLI commands, validates the valid fixture, rejects the invalid fixture, and asserts fallback to base props.

## Security notes

### Prompt injection

Treat prompts, retrieved text, tool results, and model output as untrusted input. Prompt delimiters and instructions can reduce accidental mixing but are not authorization boundaries. The schema, policy engine, registry, and runtime validator remain authoritative.

### Unsafe generated code

Executable TSX generation is limited to build or CI workflows and must be review-gated. Never evaluate model-produced JavaScript or accept unrestricted imports. Generated artifacts require the same static analysis, tests, provenance checks, and code review as handwritten source.

### Structured-output validation

Runtime personalization is structured-data-only. Reject data that does not match the generated contract, references undeclared variants or paths, includes unsafe object keys, or attempts to carry executable values. Validation failure must not partially apply output.

### Telemetry and input minimization

Collect validation outcomes and coarse diagnostics rather than raw prompts, user content, or full model output by default. Minimize inference inputs before they reach any provider, redact secrets and personal data, and define retention and access controls before enabling diagnostic capture.
