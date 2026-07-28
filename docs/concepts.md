# Concepts

This document defines the core terminology used across the Amaryllis runtime, Context Engine, component workspace, and governance model.

## Runtime Concepts

### Runtime

The React Native-facing AI subsystem. It coordinates inference and interaction state through:

- providers;
- hooks;
- controller APIs;
- streaming interfaces;
- context integration;
- lifecycle and cancellation handling.

The runtime provides model capability. It does not own product policy or rendering authority.

### Controller

The lower-level interface to the native inference engine.

Typical responsibilities include initialization, model and session lifecycle, synchronous and streaming generation, multimodal requests, cancellation, and cleanup.

### Session

Inference state that persists across related requests.

A session may support images, conversational continuity, or personalization context. It is not necessarily equivalent to a stored chat transcript.

### Model asset

An application-selected model, adapter, encoder, or related file used by the native runtime.

Applications own model licensing, distribution, integrity verification, storage, updates, rollback, and device compatibility.

## Context Concepts

### Context Engine

An interface-first memory and retrieval layer.

It provides:

- application-owned storage abstraction;
- bounded retrieval;
- TTL and item-count policy;
- validation hooks;
- optional scoring.

It does not define component policy, govern rendering authority, or make retrieved content trustworthy.

### ContextStore

The application-provided persistence interface used by the Context Engine. Implementations may use SQLite, files, another database, or a custom service.

### Retrieved context

Data selected for prompt or interaction augmentation. Retrieved context remains untrusted even when it originated locally or has known provenance.

## Component Model Concepts

### ComponentSpec

The authoritative declarative definition of a component.

A spec may define:

- metadata and version;
- props and structure;
- target framework and runtime;
- behavior and capability constraints;
- allowed AI execution mode;
- policy requirements;
- generation contracts.

The specification is authoritative. Model output is not.

### Generation contract

A declaration of what an AI workflow may produce, where it may execute, and how its output is validated.

Examples include:

- build-time TSX generation;
- props JSON;
- variant selection;
- slot text;
- constrained JSON Patch overlays.

For runtime personalization, the registered JSON Schema contract is the automatic validation boundary implemented by `PersonalizationEngine`.

### Registry

The authoritative mapping between:

- component name and version;
- specification and personalization contract;
- deterministic identity hashes;
- executable implementation identity.

The registry decides what implementation is renderable. Model output cannot register arbitrary runtime code.

Registry hashes currently provide deterministic identity and drift detection. They are not cryptographic signatures.

### Overlay

A bounded data modification applied to base props for an authoritative registered component.

Examples include approved prop updates, known variant selection, slot text, design-token values, and constrained patch operations.

The current runtime requires overlays to pass:

- the registered JSON Schema contract;
- unsafe object-key validation;
- JSON Patch path and value validation where patches are used;
- schema validation after patches are applied.

Additional semantic, capability, accessibility, network, or business policy must be encoded in the contract or composed by the application.

### Runtime personalization

AI-influenced rendering behavior where the model does not become the authoritative source of executable UI.

Typical outputs include props, variants, slot text, design-token values, and bounded overlays. Runtime personalization is intentionally more constrained than build-time source generation.

## AI Concepts

### Local AI

Inference executed on the device rather than requiring a hosted inference service.

Local execution can reduce network exposure and latency, but remains subject to client compromise, model tampering, resource limits, logging, storage, and fallback risks.

Locality is a deployment characteristic, not a guarantee of trust.

### Capability provider

A model runtime or service capable of performing a bounded task, such as:

- summarization;
- image understanding;
- personalization;
- variant selection;
- slot generation.

Amaryllis models AI as one or more capability providers rather than assuming a single authoritative assistant.

### Structured output

Model output constrained to a schema or bounded contract.

Examples include JSON, typed props, variant identifiers, and patch operations.

Structured output is easier to validate and govern than arbitrary executable source, but it is not inherently safe or semantically correct.

### Deterministic control

Application-owned logic whose behavior can be validated independently of model output.

Examples include schemas, policy engines, registry identity checks, patch validation, static analysis, and release gates.

A deterministic control is effective only when it is actually composed into the relevant execution path.

## Governance Concepts

### Policy

Rules defining what a workflow or runtime is allowed to do.

Policy may cover:

- imports and dependencies;
- runtime execution modes;
- network behavior;
- allowed and forbidden operations;
- slots, variants, and design tokens;
- accessibility requirements;
- review and approval requirements.

Policy is defined and enforced outside the model.

In the current package, `PolicyEngine` is used by build and CLI generation/customization flows. Programmatic runtime personalization does not automatically execute the complete policy engine.

### Validation

The process of confirming that an input or artifact satisfies the checks composed into its path.

Examples include:

- specification schema validation;
- runtime personalization contract validation;
- registry name, version, and hash checks;
- unsafe-key and patch validation;
- build/CLI policy validation;
- generated-source and package checks.

Validation remains deterministic even when generation is probabilistic. Passing one validation layer does not imply that every semantic or security policy has been evaluated.

### Authoritative boundary

The boundary defining which subsystem has final control over behavior.

In Amaryllis:

- the model is not authoritative;
- application code and registered implementations remain authoritative over execution;
- specifications and runtime contracts remain authoritative over declared structure and personalization data;
- application policy remains authoritative over sensitive behavior;
- runtime output must pass its registered contract before rendering.

### Provenance

Evidence describing where an artifact or decision came from.

Potential provenance includes specification, contract, model, policy, validator, generation, build, review, and release identities.

Provenance improves attribution and replayability. It does not prove correctness or safety.

### Build-time generation

AI-assisted generation occurring in local tooling, build pipelines, or CI. It may produce executable artifacts because stronger validation, testing, review, and evidence controls can be applied.

### Device-time personalization

AI-assisted adaptation occurring in the user-facing runtime. It is constrained to bounded structured output because the review and recovery conditions are materially different from build-time generation.