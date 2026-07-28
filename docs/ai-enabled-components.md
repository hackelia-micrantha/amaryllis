# AI-enabled Components

This document explains the component-governance model implemented by `@micrantha/amaryllis-components`.

The core principle is:

> Components remain declarative and authoritative while AI participates through bounded contracts.

## Motivation

AI-enabled UI commonly falls into one of two extremes:

1. a chat assistant attached to otherwise static UI;
2. unrestricted source or runtime UI generation.

The first limits adaptation. The second creates serious governance, reproducibility, accessibility, security, and design-consistency problems.

Amaryllis explores a middle path: useful AI capability inside application-owned component contracts.

## Authority Model

```text
ComponentSpec and registered implementations are authoritative.
Runtime contracts determine acceptable personalization data.
Model output is untrusted until validated.
```

The model cannot directly:

- register an implementation;
- replace a component identity;
- mutate the canonical specification;
- introduce executable imports at runtime;
- decide what React implementation is renderable;
- bypass the registered personalization contract.

Broader application policy remains external to the model. The current runtime path does not automatically invoke every package policy rule for programmatically registered components.

## ComponentSpec

`ComponentSpec` is a typed, versioned, and reviewable declaration of:

- component identity and metadata;
- props and structure;
- target framework and runtime;
- behavior constraints;
- AI execution mode;
- policy requirements;
- generation contracts.

The specification exists before a model participates and remains the source of truth after generation or personalization.

## AI Execution Modes

### Scaffold

AI generates implementation artifacts in local tooling, build pipelines, or CI.

Typical outputs include TSX, component scaffolding, tests, and derived contracts.

Because the output may be executable, it should pass normal software-delivery controls:

- specification schema and policy validation;
- generated-source validation;
- static analysis and tests;
- import and capability rules;
- preview and diff review;
- package validation;
- provenance and approval evidence.

The package's CLI generation path applies policy before generation, but applications remain responsible for their complete build and review process.

### Customize

AI adapts bounded parts of an existing component specification during tooling or build workflows.

Examples include:

- selecting known variants;
- choosing approved layouts;
- filling declared slots;
- selecting design tokens;
- producing constrained copy.

The CLI customization path validates the specification against policy before producing output. Generated changes remain subject to normal review and testing.

### Personalize

AI participates at device time using structured output.

Examples include:

- local summaries;
- adaptive slot content;
- known variant selection;
- validated props;
- bounded JSON Patch overlays.

This is the most constrained mode because output reaches the user-facing runtime without the same review window available to build-time source generation.

## Implemented Runtime Safety Model

At device time:

- model output is untrusted;
- output is validated against a registered JSON Schema contract;
- unsafe prototype-related object keys are rejected;
- JSON Patch paths and values are validated;
- patches are revalidated against the contract after application;
- registry-controlled implementations remain authoritative;
- invalid output falls back to base props;
- fallback and retry behavior remain application-controlled.

The implemented path is:

```text
prompt, context, or media
  -> model capability
  -> untrusted structured output
  -> registered contract validation
  -> unsafe-key and patch validation
  -> bounded prop overlay
  -> registered component render
```

The full `PolicyEngine` is currently used by build/CLI generation and customization flows. It is not automatically executed by every `PersonalizedComponent` call.

## Runtime Overlays

An overlay is a bounded data modification applied to base props for an authoritative registered component.

Supported patterns may include:

- approved prop changes;
- known variant selection;
- declared slot text;
- declared design-token values;
- JSON Patch operations targeting declared paths.

The runtime contract should encode all mechanically enforceable field, enum, path, and value restrictions.

Application-level checks are still required for rules that cannot be proven from JSON Schema alone, including:

- whether a validated URL or identifier grants a sensitive capability;
- accessibility behavior that depends on rendered output;
- semantic business rules;
- network and data-handling policy;
- review or approval requirements.

## Registry-centric Rendering

The registry maps component, specification, contract, version, and implementation identities.

```text
ComponentSpec
  -> registration and identity checks
  -> registered implementation and contract
  -> contract-validated overlay
  -> render
```

This preserves executable ownership in reviewed application code while allowing bounded adaptation.

Runtime registry hashes are deterministic identity values, not cryptographic signatures or proof of provenance.

## Why Local AI Matters

The Amaryllis runtime supports on-device multimodal inference. Local execution can provide:

- lower interaction latency;
- offline workflows;
- application-controlled network behavior;
- local image and text processing;
- reduced dependency on hosted-data processing.

Locality does not make model output trustworthy. It shifts the security and operational boundary to the application and device.

Applications remain responsible for:

- model distribution and integrity;
- licensing and updates;
- device resource budgets;
- logging and persistence;
- fallback behavior;
- client compromise and reverse-engineering risk.

## CopilotKit and AG-UI Integration

CopilotKit and AG-UI can provide orchestration for agent actions, shared frontend state, and generative UI flows.

Amaryllis fits as a local capability and contract-validation boundary:

```text
agent action
  -> Amaryllis inference
  -> structured output
  -> PersonalizationEngine validation
  -> registered component overlay
  -> render
```

The companion package uses optional adapter contracts rather than requiring a specific orchestration framework. Additional policy checks can be composed by the application. See [CopilotKit and AG-UI alignment](./copilotkit-ag-ui.md).

## Current Implementation

The repository includes:

- `ComponentSpec` types and schemas;
- YAML and object parsing;
- policy primitives and CLI policy validation;
- registry identity and replacement checks;
- React source generation scaffolding;
- bounded personalization outputs;
- JSON Schema, unsafe-key, patch-path, patch-value, and post-patch validation;
- package and example verification;
- CI, SBOM, and provenance controls.

The project remains an active `0.1.x` implementation. Areas still evolving include automatic runtime policy composition, preview ergonomics, approval workflows, runtime observability, model-delivery integrity, replayable evidence, and broader framework integration.

## Explicit Non-goals

The component system is not intended to provide:

- unrestricted device-time JSX or TSX generation;
- autonomous mutation of application policy;
- arbitrary runtime imports;
- automatic semantic safety from schema validation alone;
- replacement of design-system governance;
- implicit trust in local or hosted model output;
- a universal generative UI protocol.

The goal is declarative, governable, AI-enabled interfaces with explicit limits and accurately documented authority.