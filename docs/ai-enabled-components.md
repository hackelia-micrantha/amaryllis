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
ComponentSpec, registry, policy, and validation are authoritative.
AI output is advisory until it passes those controls.
```

The model cannot directly:

- register an implementation;
- replace a component identity;
- mutate authoritative policy;
- introduce executable imports at runtime;
- bypass validation;
- decide what code is renderable.

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

Because the output may be executable, it must pass normal software-delivery controls:

- schema and source validation;
- static analysis and tests;
- import and capability policy;
- preview and diff review;
- package validation;
- provenance and approval evidence.

### Customize

AI adapts bounded parts of an existing component contract.

Examples include:

- selecting known variants;
- choosing approved layouts;
- filling declared slots;
- selecting design tokens;
- producing constrained copy.

Customization cannot change implementation identity, policy, imports, or undeclared capabilities.

### Personalize

AI participates at device time using structured output.

Examples include:

- local summaries;
- adaptive slot content;
- known variant selection;
- validated props;
- bounded JSON patch overlays.

This is the most constrained mode because output reaches the user-facing runtime without the same review window available to build-time source generation.

## Runtime Safety Model

At device time:

- model output is untrusted;
- executable source generation is not the default path;
- registry-controlled implementations remain authoritative;
- schemas and policy are enforced outside the model;
- invalid output is rejected rather than coerced into authority;
- fallback behavior remains application-controlled.

The intended flow is:

```text
prompt, context, or media
  -> model capability
  -> structured output
  -> schema validation
  -> policy validation
  -> bounded overlay
  -> registry-approved render
```

## Runtime Overlays

An overlay is a bounded modification applied to an authoritative component contract.

Supported patterns may include:

- approved prop changes;
- known variant selection;
- declared slot text;
- allowlisted JSON patch operations.

Overlay validation should enforce:

- allowed paths and operations;
- value types and enum membership;
- component and contract identity;
- capability and network restrictions;
- design-token and accessibility rules.

Ambiguous recursive merging is avoided where explicit patch semantics provide a safer contract.

## Registry-centric Rendering

The registry maps component, specification, contract, version, and implementation identities.

```text
ComponentSpec
  -> validation
  -> registry resolution
  -> approved implementation
  -> validated overlay
  -> render
```

This preserves executable ownership in reviewed application code while allowing bounded adaptation.

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

Amaryllis fits as a local capability and governance boundary:

```text
agent action
  -> Amaryllis inference
  -> structured output
  -> ComponentSpec validation
  -> registry-approved overlay
  -> render
```

The companion package uses optional adapter contracts rather than requiring a specific orchestration framework. See [CopilotKit and AG-UI alignment](./copilotkit-ag-ui.md).

## Current Implementation

The repository includes:

- `ComponentSpec` types and schemas;
- YAML and object parsing;
- policy primitives;
- registry and identity validation;
- React source generation scaffolding;
- bounded personalization outputs;
- patch and overlay validation;
- package and example verification;
- CI, SBOM, and provenance controls.

The project remains an active `0.1.x` implementation. Areas still evolving include preview ergonomics, approval workflows, runtime observability, model-delivery integrity, replayable evidence, and broader framework integration.

## Explicit Non-goals

The component system is not intended to provide:

- unrestricted device-time JSX or TSX generation;
- autonomous mutation of application policy;
- arbitrary runtime imports;
- replacement of design-system governance;
- implicit trust in local or hosted model output;
- a universal generative UI protocol.

The goal is declarative, governable, AI-enabled interfaces with explicit limits and reviewable authority.
