# Architecture

This document provides a working mental model for the current Amaryllis repository. It is intentionally lighter than the component RFC and focuses on subsystem ownership, data flow, and trust boundaries.

## System Layers

Amaryllis contains three related but independently governed layers.

### 1. On-device runtime

The runtime is responsible for:

- exposing React Native provider, hook, and controller APIs;
- initializing native model runtimes;
- managing multimodal sessions;
- streaming output and cancellation;
- integrating optional context retrieval;
- keeping network fallback under application control.

At this layer, Amaryllis is an inference SDK. It does not own product policy or rendering authority.

### 2. Context Engine

The Context Engine is an interface-first memory and retrieval subsystem.

It provides:

- application-owned storage integration;
- bounded retrieval;
- TTL and item-count policy;
- validation hooks;
- optional scoring and ranking.

It does not define component policy, replace the component registry, or make retrieved content trustworthy.

### 3. Component governance

`@micrantha/amaryllis-components` defines how AI may participate in component generation and runtime personalization.

It provides:

- typed and versioned `ComponentSpec` contracts;
- schema validation;
- policy primitives and build/CLI policy validation;
- registry and implementation identity primitives;
- generation scaffolding;
- bounded runtime overlays;
- runtime JSON Schema, unsafe-key, and patch validation.

The component layer answers a different question from the inference runtime:

> How can AI influence component generation or behavior without becoming an unbounded runtime code-execution authority?

## Layered View

```text
Application UI
  -> React Native components
  -> navigation, state, business logic, and application policy

Application-owned configuration
  -> model assets and lifecycle
  -> ContextStore
  -> fallback and network behavior

Amaryllis runtime
  -> LLMProvider
  -> hooks
  -> controller
  -> Context Engine
  -> native Android and iOS inference

Component tooling
  -> ComponentSpec schema validation
  -> build/CLI policy validation
  -> generated artifacts and registered implementations

Runtime personalization
  -> registry lookup
  -> registered JSON contract
  -> schema, unsafe-key, and patch validation
  -> bounded data overlay
  -> registered component render
```

The application owns the top-level authority. The model supplies capability within those boundaries.

## Authority Model

The architecture distinguishes probabilistic capability from deterministic authority.

Authoritative systems include:

- application code and policy;
- component specifications;
- runtime personalization contracts;
- registries and implementation identities;
- lifecycle and rendering code;
- build and release controls.

Model output is advisory until it has passed the checks actually composed into its execution path.

At runtime, the current package automatically enforces the registered JSON contract, unsafe-key restrictions, and JSON Patch bounds. Broader policy such as network, accessibility, semantic business rules, and review requirements must be encoded in the contract, kept in component code, or composed by the application.

## Why the Separation Matters

Without explicit boundaries, AI-enabled UI tends to drift toward one of two extremes.

### Arbitrary source generation

Allowing a model to produce authoritative runtime JSX or TSX is flexible, but weak for security, reviewability, reproducibility, accessibility, and design governance.

### Static UI with a chat layer

Keeping AI isolated in a chat surface is easier to reason about, but does not enable meaningful component adaptation.

Amaryllis takes a middle path:

- local inference is available as a capability;
- component behavior is contract-driven;
- runtime output is structured and schema-validated;
- executable implementations remain registry-controlled;
- application code remains responsible for final behavior and policy.

## Build-Time and Device-Time AI

The architecture treats build-time generation and device-time personalization as different trust classes.

### Build-time or CI-time generation

Build-time workflows may generate source or larger artifacts because the output can pass through:

- specification schema validation;
- package policy validation;
- generated-source analysis;
- static analysis;
- tests and previews;
- human review;
- provenance and artifact tracking.

Typical outputs include generated React source, implementation scaffolding, reviewable diffs, and package artifacts.

### Device-time personalization

Device-time output is substantially more constrained. The model acts as an untrusted structured-data producer rather than a source-code generator.

Typical outputs include:

- props JSON;
- variant selection;
- slot text;
- design-token values;
- constrained JSON Patch operations.

The current automatic runtime checks are contract/schema, unsafe-key, and patch validation. Full package policy evaluation is not implicitly performed for every programmatic runtime registration.

## Context Placement

The Context Engine sits beside the inference runtime. It enriches prompts and interactions, but does not sit above the component policy layer.

```text
ContextStore
  -> bounded retrieval
  -> prompt or interaction context
  -> model capability
  -> independently validated output
```

Retrieval provenance can improve attribution, but does not make retrieved content safe.

## CopilotKit and AG-UI Placement

CopilotKit and AG-UI fit at the application orchestration boundary. They may coordinate actions, shared frontend state, and generative UI flows, but they do not replace Amaryllis registry or contract validation.

```text
AG-UI or CopilotKit action
  -> Amaryllis inference capability
  -> structured output
  -> PersonalizationEngine validation
  -> registered component overlay
  -> render
```

The companion package therefore uses optional adapter contracts rather than making orchestration frameworks part of the core runtime. Applications can compose additional policy around those adapters.

## Security Boundaries

The primary boundaries are:

1. application input crossing into native inference;
2. retrieved context crossing into prompts;
3. model output crossing into application-controlled logic;
4. generated artifacts crossing into source and package outputs;
5. registry identities crossing into rendered implementations;
6. model assets crossing into the application trust boundary.

The corresponding rules are:

- model output is not authoritative;
- context is not trusted merely because it is local;
- component specs and registries remain authoritative;
- runtime output must satisfy its registered contract;
- additional semantic and capability policy must be explicitly composed;
- build-time source and device-time data use different review controls;
- local inference shifts risk rather than eliminating it.

## Design Direction

The current direction is to:

- keep Amaryllis focused on local mobile AI execution;
- keep the Context Engine storage-agnostic and application-owned;
- make AI-enabled components declarative, typed, and governable;
- compose broader policy into runtime personalization without conflating it with schema validation;
- improve model delivery and integrity controls;
- strengthen runtime observability and failure recovery;
- preserve a clear boundary between inference capability and product authority.

For more detail, see:

- [Concepts](./concepts.md)
- [AI-enabled components](./ai-enabled-components.md)
- [Runtime personalization](./runtime-personalization.md)
- [Registry and validation](./registry-and-validation.md)
- [Local AI and MediaPipe](./local-ai.md)
- [CopilotKit and AG-UI alignment](./copilotkit-ag-ui.md)
- [Security model](./security-model.md)
- [Threat model](./threat-model.md)
- [Amaryllis Components RFC](./amaryllis_ai_component_module_rfc.md)