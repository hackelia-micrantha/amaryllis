# Security Model

This document describes the architectural security model for Amaryllis. It covers the on-device inference runtime, Context Engine, AI-assisted component workflows, and runtime personalization.

It is not a compliance claim or a substitute for application-specific threat modeling.

## Core Principle

```text
AI output is not authoritative.
```

Authority remains in deterministic, application-controlled systems:

- application code and lifecycle rules;
- component specifications;
- registries and implementation identities;
- schemas and policy;
- validation and rendering logic;
- build, review, and release controls.

AI is treated as a bounded capability provider operating inside those constraints.

## Trust Boundaries

### Model output boundary

Generated source, multimodal responses, props JSON, slot content, variants, and patch operations are untrusted until validated.

The runtime must never assume:

```text
model output == safe executable UI
```

### Runtime authority boundary

The renderer and application code are authoritative. The model cannot directly:

- control rendering;
- bypass validation;
- mutate authoritative specs;
- replace registry entries;
- escalate runtime permissions;
- enable network access or imports.

The intended path is:

```text
structured output
  -> schema validation
  -> policy validation
  -> bounded overlay
  -> registry-approved render
```

### Registry boundary

The registry binds component, specification, runtime contract, version, and implementation identities. Only registered implementations are renderable.

Runtime model output cannot introduce a new executable implementation.

### Policy boundary

Policy exists outside the model and is enforced deterministically. Policy may constrain:

- imports and dependencies;
- runtime execution modes;
- overlay paths;
- slots, variants, and design tokens;
- network behavior;
- accessibility requirements;
- review and approval requirements.

### Context boundary

User input, retrieved content, persisted memory, and media may all contain hostile or misleading instructions. Local provenance does not imply safety.

Context can influence inference but cannot bypass output validation.

### Native and model-asset boundary

Model files, media decoders, native bridges, URIs, and platform APIs execute within the mobile client trust boundary. Applications remain responsible for model integrity, licensing, storage, updates, and platform hardening.

## Major Threat Surfaces

### Prompt injection

Potential vectors include user prompts, retrieved context, multimodal inputs, slot content, and persisted personalization data.

Controls include:

- structured output contracts;
- bounded schemas;
- independent policy enforcement;
- strict overlay validation;
- separation between prompt formatting and rendering authority.

### Arbitrary runtime source generation

Unrestricted device-time JSX, TSX, JavaScript, imports, or markup creates arbitrary execution, import injection, review bypass, and accessibility risks.

Runtime personalization therefore prefers:

- props JSON;
- known variant identifiers;
- approved slot text;
- constrained JSON patch operations.

Executable source generation belongs in build or CI workflows with stronger review controls.

### Structured-output escalation

Structured data can still trigger unsafe behavior through disallowed fields, values, or patch paths.

Controls include:

- path allowlists;
- strict enums and token sets;
- type validation;
- rejection of changes to policy, identity, implementation, or capability fields;
- explicit overlay semantics instead of ambiguous deep merges.

### Multimodal input risks

Images and other media introduce malformed-input, resource-exhaustion, hidden-prompt, and data-extraction risks.

Applications should constrain:

- file size and image count;
- URI schemes and file locations;
- preprocessing and decoding;
- token and session budgets;
- memory use and cancellation;
- error and fallback behavior.

### Registry integrity failure

A spec or implementation identity mismatch can lead to unauthorized substitution or stale behavior.

Controls include versioned identities, explicit replacement semantics, mismatch rejection, and reviewable registration.

### Privacy boundary erosion

Local inference can still leak data through logs, telemetry, implicit network fallback, generated artifacts, or application-controlled storage.

Network behavior, logging, persistence, and publication must remain explicit application decisions.

## Build-Time and Device-Time Security

### Build-time or CI generation

Build-time generation may produce executable source or larger transformations, but should require:

- schema and policy validation;
- generated-source analysis;
- tests and static checks;
- human review;
- provenance and artifact tracking;
- deterministic package validation.

### Device-time personalization

Device-time output is more constrained because it executes in the user-facing runtime and may be influenced by untrusted input.

The device-time model assumes:

- model behavior is probabilistic;
- output is untrusted;
- rendering boundaries must remain stable;
- policy enforcement is external;
- failure must be observable and recoverable.

## Local AI Security Characteristics

Local inference can provide:

- reduced hosted-data exposure;
- offline operation;
- lower latency;
- application-controlled network behavior;
- local multimodal processing.

It also introduces or preserves:

- client compromise and reverse engineering;
- malicious or replaced model assets;
- model licensing and distribution risk;
- device resource exhaustion;
- sensitive local storage;
- platform-specific native attack surfaces.

Local execution changes where trust and exposure exist. It does not make the system automatically secure.

## Validation Responsibilities

Validation should remain deterministic even when generation is probabilistic.

Responsibilities include:

- schema validation;
- component and contract identity checks;
- patch-path and value validation;
- variant and slot validation;
- import and capability restrictions;
- runtime-mode restrictions;
- accessibility and design-token enforcement;
- generated-source checks;
- failure reporting and safe fallback.

## Provenance and Evidence

Useful evidence may include:

- spec and contract hashes;
- model identity and version;
- validator and policy versions;
- generation inputs and outputs;
- build and test results;
- review and approval metadata;
- package SBOMs and release attestations.

Provenance improves attribution and replayability, but does not prove that an output is safe or correct.

## Explicit Non-Goals

The current architecture does not aim to provide:

- unrestricted runtime code generation;
- autonomous mutation of authoritative UI contracts;
- implicit model trust;
- hidden policy enforcement;
- unrestricted imports or network behavior;
- security merely because inference is local;
- a complete mobile sandbox for hostile model assets.

## Open Security Work

High-value future work includes:

- signed model and registry manifests;
- stronger model-delivery integrity;
- runtime audit and observability interfaces;
- replayable personalization evidence;
- policy-version negotiation;
- capability isolation;
- multimodal adversarial test corpora;
- device-specific resource and abuse testing.

The current priority is to keep trust boundaries stable and explicit before expanding generation flexibility.
