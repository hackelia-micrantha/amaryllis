# Architecture

This document explains the architecture of the `feature/ai-components` branch.

It is intentionally lighter than the RFC. The goal here is to provide a working mental model for contributors and users before they dive into the more normative component-governance material.

## Branch Structure

This branch contains two related but distinct layers:

1. **Base Amaryllis runtime**
   - a React Native runtime for on-device multimodal AI
   - native inference bridges for mobile
   - hooks, provider, controller, and context integration

2. **`@micrantha/amaryllis-components` companion module**
   - a spec-driven component layer
   - validation, policy, generation, and personalization primitives
   - a path toward governed AI-enabled components

The important separation is that the base runtime is primarily concerned with **local inference**, while the companion module is concerned with **how AI is allowed to influence component behavior and generation**.

---

## Layered View

```text
Application UI
  -> React Native components
  -> app state / navigation / business logic

Amaryllis Runtime Layer
  -> LLMProvider
  -> hooks
  -> controller
  -> Context Engine

Native Inference Layer
  -> TurboModule bridge
  -> platform runtime
  -> on-device model execution

Component Governance Layer
  -> ComponentSpec
  -> schema validation
  -> policy engine
  -> registry / runtime overlays

Generated or Personalized Output
  -> validated props
  -> variant selection
  -> slot content
  -> bounded JSON patch overlays
```

---

## Base Runtime Responsibilities

The base runtime is responsible for:

- initializing the local model runtime
- exposing a React Native API surface
- managing sessions for multimodal flows
- handling streaming output
- integrating optional context retrieval
- keeping inference local to the device unless the application chooses otherwise

At this layer, the system is still fundamentally an inference SDK.

---

## Companion Module Responsibilities

The companion module exists to answer a different question:

> How should AI participate in component generation or runtime personalization without turning the UI into an unbounded code-execution surface?

That module introduces a typed `ComponentSpec` and a supporting toolchain for:

- parsing and validating specs
- enforcing policy constraints
- generating artifacts
- constraining runtime personalization
- preserving an authoritative component contract

This is the branch’s most important architectural move.

---

## Why the Separation Matters

Without a clear separation, the system easily drifts into one of two poor extremes:

### Extreme 1: AI as arbitrary source generator

This is fast for experimentation, but weak for governance, reproducibility, and security.

### Extreme 2: AI as a thin chat layer bolted onto static UI

This is safer, but it does not really unlock AI-enabled components or adaptive interfaces.

The architecture in this branch aims for the middle path:

- local AI is available as a capability
- component behavior is spec-driven
- runtime outputs are bounded and validated
- the authoritative UI contract remains outside the model

---

## Build-Time vs Device-Time AI

A critical distinction in this branch is the difference between:

### Build-time or CI-time generation

This is where the system can allow more powerful transformations, including source generation, so long as policy, validation, and review controls are enforced.

Typical outputs:

- generated React code
- generated artifacts
- reviewable diffs
- provenance metadata

### Device-time personalization

This is much more constrained.

On device, AI should behave as an **untrusted structured-data producer**, not as a code generator.

Typical outputs:

- props JSON
- variant selection
- slot text
- limited JSON patch overlays

That distinction is central to the safety model of the branch.

---

## Context Engine Placement

The Context Engine sits beside the inference runtime, not above the component spec layer.

Its role is to provide:

- memory
- retrieval
- bounded context augmentation
- interface-first storage integration

It should not be confused with a policy engine or a component registry. It is a supporting subsystem for prompt and interaction context.

---

## Security Boundaries

This branch creates several important trust boundaries:

1. **Model output is not authoritative**
2. **Component specs are authoritative**
3. **Registry and validation decide what can be rendered**
4. **Device-time AI output must be schema- and policy-validated**
5. **Source generation is treated differently from runtime personalization**

That lets the system support adaptive behavior without implicitly trusting the model as a code author at runtime.

---

## Design Direction

The overall direction of this branch is:

- keep Amaryllis as the local AI runtime substrate
- build a companion component model on top of it
- make AI-enabled components declarative, typed, and governable
- preserve a strong distinction between inference capability and UI authority

For the detailed component contract and enforcement model, see:

- [AI-enabled components](./ai-enabled-components.md)
- [Concepts](./concepts.md)
- [Local AI and MediaPipe](./local-ai.md)
- [Amaryllis Components RFC](./amaryllis_ai_component_module_rfc.md)
