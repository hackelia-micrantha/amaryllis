# @micrantha/amaryllis-components

> **Experimental:** this package and the `amaryllis/v1alpha1` schema are branch-level APIs under active stabilization. They are not yet stable public contracts.

`@micrantha/amaryllis-components` is a companion module for Amaryllis that explores **spec-driven, governed, AI-enabled React components**.

It sits above the base Amaryllis runtime.

- `@micrantha/react-native-amaryllis` provides local multimodal inference for React Native
- `@micrantha/amaryllis-components` provides component contracts, validation, policy, build-time generation, registration, and structured runtime personalization

The companion package is provider-neutral and does not execute a model. Applications supply untrusted structured output from the base runtime or another inference boundary, then validate it against the registered contract.

The guiding rule is:

> The component spec is authoritative. AI participates through bounded contracts.

---

## What this package does

This package introduces a typed `ComponentSpec` model and supporting tooling for:

- schema-backed component specs
- YAML parsing
- policy enforcement
- build-time generation scaffolding
- runtime personalization overlays
- bounded structured outputs

It is not intended to allow unrestricted runtime JSX or TSX generation. Executable generation belongs in build or CI, with static checks and human review before promotion.

---

## Mental model

```text
ComponentSpec
  -> validation
  -> policy checks
  -> generated artifact or runtime contract
  -> registry / overlay application
  -> rendered component
```

This package is for the layer that governs how AI may influence UI behavior.

---

## Current scope

The current branch includes:

- `ComponentSpec` type definitions
- JSON schema generation
- YAML parser helpers
- policy engine primitives
- runtime engine and hooks
- a `PersonalizedComponent` runtime concept
- CLI scaffolding
- provider-free examples and verification

Several areas remain open and are tracked in [`GAPS.md`](./GAPS.md).

---

## Installation

From the monorepo:

```sh
yarn workspace @micrantha/amaryllis-components build
```

This package currently expects React 18+.

---

## End-to-end example

The [end-to-end AI component walkthrough](../../docs/examples/ai-component-end-to-end.md) covers:

- the `generate`, `contract`, and `customize` CLI commands
- registration of an approved component implementation
- valid structured personalization output
- invalid output and deterministic fallback to base props
- build/CI verification
- prompt injection, generated-code, validation, and telemetry boundaries

Run the automated example verification with:

```sh
yarn verify:component-examples
```

The underlying spec is [`../../docs/examples/summary-card.component.yaml`](../../docs/examples/summary-card.component.yaml).

---

## Example usage

### Parse a spec

```ts
import { parseComponentSpec } from '@micrantha/amaryllis-components';

const spec = parseComponentSpec(`
apiVersion: amaryllis/v1alpha1
kind: ComponentSpec
metadata:
  name: SummaryCard
  version: 0.1.0
target:
  framework: react
  runtime: rn
props:
  type: object
  properties:
    title:
      type: string
ai:
  mode: personalize
  execution: device
  generationContract:
    output: props-json
`);
```

### Think in bounded outputs

Typical device-time outputs should be structured and validated, for example:

- props JSON
- variant selection
- slot text
- limited JSON patch overlays

Build-time generation may be broader, but runtime personalization remains structured-data-only.

---

## Relationship to the base runtime

This package does not replace the base Amaryllis runtime.

Instead:

- `@micrantha/react-native-amaryllis` provides the inference substrate and native runtime integration
- `@micrantha/amaryllis-components` provides the experimental component governance, generation, registry, and personalization model

That separation is deliberate. Neither prompt instructions nor model output may bypass schema, policy, registry, or validation boundaries.

---

## Key documents

- [End-to-end example](../../docs/examples/ai-component-end-to-end.md)
- [Root architecture overview](../../docs/architecture.md)
- [Local AI and MediaPipe](../../docs/local-ai.md)
- [Concepts](../../docs/concepts.md)
- [AI-enabled components](../../docs/ai-enabled-components.md)
- [Runtime personalization](../../docs/runtime-personalization.md)
- [RFC: Amaryllis Components Companion Module](../../docs/amaryllis_ai_component_module_rfc.md)
- [Gap tracker](./GAPS.md)

---

## Security model

This package assumes:

- prompt content and model output are untrusted
- runtime AI output is rejected until structurally validated
- specs and registries remain authoritative
- policy is enforced outside the model
- device-time AI cannot become an unrestricted source-code execution path
- telemetry and inference inputs are minimized by default

That is the core architectural distinction of the branch.
