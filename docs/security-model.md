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
- runtime personalization contracts;
- validation and rendering logic;
- build, review, and release controls.

AI is treated as a capability provider operating inside those constraints.

## Implemented Runtime Security Boundary

The current `PersonalizedComponent` path provides these automatic controls:

```text
registered component lookup
  -> registered JSON contract
  -> JSON Schema validation
  -> unsafe object-key validation
  -> JSON Patch path and value validation
  -> post-patch schema validation
  -> bounded prop merge
  -> registered implementation render
```

This path prevents model output from directly becoming JSX, TSX, JavaScript, imports, or a newly registered implementation.

It does **not** automatically invoke the complete package `PolicyEngine` for every programmatic runtime personalization call.

## Trust Boundaries

### Model output boundary

Generated source, multimodal responses, props JSON, slot content, variants, design-token values, and patch operations are untrusted until processed by the controls applicable to their execution path.

The runtime must never assume:

```text
model output == safe executable UI
```

### Runtime authority boundary

The renderer and application code are authoritative. The model cannot directly:

- register or replace a React implementation;
- mutate the canonical specification or registry entry;
- introduce executable source or imports through personalization data;
- bypass the registered JSON contract;
- decide what implementation is renderable.

Validated data can still trigger behavior already implemented by the application. Contracts and component code must therefore constrain capability-bearing values such as URLs, commands, identifiers, or native-operation selectors.

### Registry boundary

The registry binds component name, version, specification, personalization contract, deterministic hashes, and implementation identity.

Registration rejects inconsistent names, versions, or supplied hashes, and replacement is explicit.

The current FNV-derived hashes are useful for deterministic identity and drift detection. They are not cryptographic signatures, tamper-proof manifests, or proof that code is trustworthy.

### Policy boundary

Policy exists outside the model and must be enforced deterministically.

The package currently applies `PolicyEngine` validation in build and CLI generation/customization flows. The programmatic runtime personalization path does not automatically apply every policy rule.

Runtime applications requiring broader policy must explicitly compose checks for concerns such as:

- network and external capabilities;
- semantic business rules;
- accessibility behavior dependent on rendered output;
- design-system rules not encoded in the JSON contract;
- review, approval, and data-handling requirements.

Schema validity is necessary but not sufficient for semantic safety.

### Context boundary

User input, retrieved content, persisted memory, and media may contain hostile or misleading instructions. Local provenance does not imply safety.

Context can influence inference but cannot change the registry or bypass the registered personalization contract.

### Native and model-asset boundary

Model files, media decoders, native bridges, URIs, and platform APIs execute within the mobile client trust boundary.

Applications remain responsible for model integrity, licensing, storage, updates, platform hardening, resource budgets, and fallback behavior.

## Major Threat Surfaces

### Prompt injection

Potential vectors include user prompts, retrieved context, multimodal inputs, slot content, and persisted personalization data.

Controls include:

- structured-output contracts;
- bounded schemas;
- separation between prompt formatting and rendering authority;
- patch-path validation;
- application-composed semantic and capability policy.

Contract validation reduces the output surface but does not make hostile prompt content harmless.

### Arbitrary runtime source generation

Unrestricted device-time JSX, TSX, JavaScript, imports, or markup creates arbitrary execution, import injection, review bypass, and accessibility risks.

The current personalization path accepts data, not executable source. Executable generation belongs in build or CI workflows with stronger review controls.

### Structured-output escalation

Structured data can still trigger unsafe behavior through allowed fields or values.

Examples include:

- a validated URL prop that causes a component to contact an unapproved endpoint;
- an identifier that selects a sensitive application capability;
- semantically invalid text that still satisfies its JSON type;
- a permitted design token that produces inaccessible rendered output.

Controls must combine schema restrictions with reviewed component behavior and application policy.

### Prototype and patch abuse

The runtime rejects or ignores `__proto__`, `constructor`, and `prototype` keys. JSON Patch paths are constrained to declared personalization sections, and patched output is schema-validated again.

These controls reduce prototype-pollution and overlay-escape risk. They do not replace application testing of complex contracts.

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

A specification, contract, or implementation identity mismatch can lead to unauthorized substitution or stale behavior.

Current controls include deterministic identity construction, registration mismatch rejection, explicit replacement, snapshots, and validated hydration.

Future cryptographic signing is still required for stronger supply-chain integrity claims.

### Privacy boundary erosion

Local inference can still leak data through logs, telemetry, implicit network fallback, generated artifacts, or application-controlled storage.

Network behavior, logging, persistence, and publication must remain explicit application decisions.

## Build-Time and Device-Time Security

### Build-time or CI generation

Build-time generation may produce executable source or larger transformations. Depending on the workflow, controls may include:

- specification schema and package policy validation;
- generated-source analysis;
- tests and static checks;
- human review;
- package and entrypoint validation;
- provenance, SBOM, and artifact tracking.

These controls provide a review window unavailable to device-time personalization.

### Device-time personalization

Device-time output is more constrained because it executes in the user-facing runtime and may be influenced by untrusted input.

The current automatic checks are:

- registered component and contract lookup;
- JSON Schema validation;
- unsafe-key validation;
- JSON Patch path and value validation;
- post-patch schema validation;
- fallback to base props on failure.

Additional semantic, capability, accessibility, privacy, and network policy remains application-controlled unless explicitly composed.

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

### Implemented runtime validation

- JSON Schema contract validation;
- unsafe object-key detection;
- patch-path and patch-value validation;
- post-patch schema validation;
- safe merge into base props;
- observable validation errors and diagnostics.

### Build or CLI validation

- specification schema validation;
- package policy validation for generation and customization;
- generated-source checks;
- package and entrypoint verification.

### Application responsibilities

- semantic business rules;
- sensitive capability authorization;
- network and data-handling policy;
- rendered accessibility and interaction checks;
- privacy-safe telemetry;
- model and asset integrity;
- operational fallback and monitoring.

## Provenance and Evidence

Useful evidence may include:

- spec and contract hashes;
- model identity and version;
- validator and policy versions;
- generation inputs and outputs;
- build and test results;
- review and approval metadata;
- package SBOMs and release attestations.

Provenance improves attribution and replayability, but does not prove that an output is safe or correct. Non-cryptographic registry hashes must not be presented as attestations.

## Explicit Non-goals

The current architecture does not aim to provide:

- unrestricted runtime code generation;
- autonomous mutation of authoritative UI contracts;
- implicit model trust;
- automatic full-policy enforcement for every runtime call;
- unrestricted imports or network behavior;
- security merely because inference is local;
- a complete mobile sandbox for hostile model assets.

## Open Security Work

High-value future work includes:

- compose `PolicyEngine` into optional runtime enforcement;
- signed model and registry manifests;
- cryptographic model-delivery integrity;
- runtime audit and observability interfaces;
- replayable personalization evidence;
- policy-version negotiation;
- capability isolation;
- multimodal adversarial test corpora;
- device-specific resource and abuse testing.

The current priority is to keep implemented guarantees, application responsibilities, and future controls distinct before expanding generation flexibility.