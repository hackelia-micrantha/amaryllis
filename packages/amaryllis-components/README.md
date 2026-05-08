# @micrantha/amaryllis-components

`@micrantha/amaryllis-components` is a companion module for Amaryllis that explores **spec-driven, governed, AI-enabled React components**.

It sits above the base Amaryllis runtime.

- The base runtime provides **local multimodal inference** for React Native
- This package provides **component contracts, validation, policy, generation, and personalization primitives**

The guiding rule is:

> The component spec is authoritative. AI participates through bounded contracts.

---

## What this package does

This package introduces a typed `ComponentSpec` model and supporting tooling for:

- schema-backed component specs
- YAML parsing
- policy enforcement
- generation scaffolding
- runtime personalization overlays
- bounded structured outputs

It is not intended to allow unrestricted runtime JSX or TSX generation.

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
- tests and an example spec

Several areas remain open and are tracked in [`GAPS.md`](./GAPS.md).

---

## Installation

From the monorepo:

```sh
yarn workspace @micrantha/amaryllis-components build
```

This package currently expects React 18+.

---

## Example spec

A minimal example lives at [`example-spec.yaml`](./example-spec.yaml).

It demonstrates:

- metadata and target selection
- props schema
- UI layout and slots
- AI execution mode
- generation contract
- policy constraints

---

## Example usage

### Parse a spec

```ts
import { parseSpec } from '@micrantha/amaryllis-components/dist/parser/yaml';

const spec = parseSpec(`
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

Build-time generation may be broader, but runtime personalization should remain bounded.

---

## Relationship to the base runtime

This package does not replace the base Amaryllis runtime.

Instead:

- `react-native-amaryllis` provides the inference substrate
- `@micrantha/amaryllis-components` provides the component governance and personalization model

That separation is deliberate.

---

## Key documents

- [Root architecture overview](../../docs/architecture.md)
- [Local AI and MediaPipe](../../docs/local-ai.md)
- [Concepts](../../docs/concepts.md)
- [AI-enabled components](../../docs/ai-enabled-components.md)
- [RFC: Amaryllis Components Companion Module](../../docs/amaryllis_ai_component_module_rfc.md)
- [Gap tracker](./GAPS.md)

---

## Security model

This package assumes:

- runtime AI output is untrusted until validated
- specs and registries remain authoritative
- policy is enforced outside the model
- device-time AI should not become an unrestricted source-code execution path

That is the core architectural distinction of the branch.
