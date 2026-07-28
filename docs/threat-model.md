# Threat Model

This document describes the primary threat surfaces for the current Amaryllis architecture:

- the React Native runtime for local multimodal inference;
- the application-owned Context Engine;
- `@micrantha/amaryllis-components` generation and personalization workflows.

The model is intentionally architectural rather than exhaustive. Applications integrating Amaryllis must extend it for their data, models, devices, deployment paths, and regulatory requirements.

## Security Posture

> Model output is not authoritative.

This leads to three baseline rules:

1. model and retrieved output are untrusted until validated;
2. application code, component specs, registries, and policy remain authoritative;
3. device-time AI is bounded to structured output rather than unrestricted executable UI generation.

## Assets

Important assets include:

- model and adapter files;
- prompts, retrieved context, and persisted memory;
- user-provided media;
- component specifications and generation contracts;
- runtime personalization outputs;
- generated source and package artifacts;
- policy definitions;
- registry entries and implementation identities;
- application secrets, network credentials, and local storage;
- build, review, provenance, and release evidence.

## Trust Boundaries

### B1: Application input to inference runtime

Text, media, and application context cross into native inference.

Risks include prompt injection, malformed media, URI abuse, resource exhaustion, and unexpected multimodal behavior.

### B2: Context store to prompt construction

Retrieved or persisted content crosses into model input.

Risks include context poisoning, stale data, indirect prompt injection, privacy leakage, and mistaken trust in provenance.

### B3: Model output to application logic

Probabilistic output crosses into application-controlled rendering and behavior.

Risks include invalid structured output, policy violations, hidden capability escalation, overlay drift, and unsafe fallback.

### B4: Generator to executable artifact

Build-time generation crosses into source, packages, or derived contracts.

Risks include unsafe imports, dynamic execution, hidden network behavior, accessibility regressions, design drift, and provenance loss.

### B5: Registry to rendered implementation

Registry identity is resolved into executable application code.

Risks include spec or implementation mismatch, stale identities, unauthorized replacement, and review bypass.

### B6: Model distribution to native runtime

Application-selected model files cross into the mobile trust boundary.

Risks include model substitution, tampering, incompatible artifacts, licensing failures, resource abuse, and parser or runtime vulnerabilities.

## Threat Categories

### T1: Prompt injection

**Description:** User-controlled, retrieved, or multimodal content attempts to override intended inference or personalization boundaries.

**Examples:**

- retrieved memory instructs the model to emit fields outside the schema;
- image text attempts to override component policy;
- slot content asks the model to change capability or network settings.

**Controls:**

- keep policy and rendering authority outside the model;
- validate output independently of prompt source;
- use bounded structured contracts;
- treat retrieved and multimodal content as untrusted;
- separate prompt construction from execution authority.

### T2: Arbitrary runtime code generation

**Description:** A device-time model produces JSX, TSX, JavaScript, imports, or markup that becomes authoritative UI logic.

**Impact:** Capability escalation, hidden behavior, unreviewed network access, rendering injection, and loss of reproducibility.

**Controls:**

- prohibit runtime source generation by default;
- accept structured props, variants, slots, or patches instead;
- validate before rendering;
- keep executable implementations registry-controlled.

### T3: Policy bypass through structured output

**Description:** A model uses allowed data structures to trigger disallowed behavior.

**Examples:**

- patching unauthorized paths;
- selecting values that indirectly enable unsafe behavior;
- changing identity, policy, or capability fields;
- exploiting ambiguous deep-merge behavior.

**Controls:**

- allowlist patch paths and operations;
- use strict enums and typed values;
- define overlay semantics explicitly;
- reject changes to authoritative fields;
- fail closed on unknown values or schema versions.

### T4: Registry integrity failure

**Description:** The rendered implementation does not match the expected component, specification, version, or runtime contract.

**Impact:** Unauthorized substitution, stale behavior, review bypass, and inconsistent rendering.

**Controls:**

- bind registry entries to versioned identities;
- reject mismatches;
- require explicit replacement semantics;
- preserve reviewable registration and provenance;
- consider signed manifests for higher-assurance deployments.

### T5: Generated source abuse

**Description:** Build-time or CI-time generation produces unsafe executable artifacts.

**Examples:** Unsafe imports, dynamic execution, raw markup sinks, undeclared capabilities, hidden persistence, or network behavior.

**Controls:**

- validate source after generation;
- enforce import allowlists and sink denylists;
- run lint, type checks, tests, and security analysis;
- require human review for executable output;
- record generation and approval evidence.

### T6: Media and native resource exhaustion

**Description:** Large, malformed, or adversarial media causes memory pressure, CPU exhaustion, crashes, or inference instability.

**Controls:**

- bound file size, dimensions, count, tokens, and session duration;
- restrict URI schemes and file locations;
- preprocess and validate media;
- support cancellation and lifecycle cleanup;
- recover safely without implicit network fallback.

### T7: Context poisoning

**Description:** Stored or retrieved context influences output in misleading or hostile ways.

**Impact:** Policy drift, invalid personalization, degraded relevance, and indirect prompt injection.

**Controls:**

- treat context as untrusted;
- bound retrieval and formatting;
- validate final output independently;
- preserve attribution without equating provenance with safety;
- support deletion, expiration, and source-specific policy.

### T8: Privacy boundary erosion

**Description:** A local-first workflow leaks prompts, media, context, or personalization data through logs, telemetry, fallback, storage, or generated artifacts.

**Controls:**

- make network behavior explicit and application-controlled;
- minimize sensitive logging;
- document persistence and retention;
- separate local personalization from publishable artifacts;
- audit error reporting and fallback paths.

### T9: Accessibility and design drift

**Description:** Generated or personalized output is structurally valid but violates accessibility or design-system rules.

**Controls:**

- encode machine-checkable accessibility and token rules;
- constrain variants, slots, and design tokens;
- preserve registry-controlled implementations;
- include accessibility testing in generated-source review.

### T10: Model or adapter tampering

**Description:** A model asset is replaced, corrupted, or supplied from an untrusted distribution path.

**Impact:** Changed behavior, targeted output manipulation, runtime failure, licensing violations, or native exploitation.

**Controls:**

- verify hashes or signatures before activation;
- bind model identity to configuration and evidence;
- use application-controlled storage and update paths;
- reject incompatible or unexpected artifacts;
- document rollback and revocation behavior.

### T11: Unsafe fallback or capability expansion

**Description:** Failure of local inference causes an application to silently switch to a remote service or broader capability set.

**Impact:** Privacy violations, policy bypass, inconsistent behavior, and unexpected cost or availability dependencies.

**Controls:**

- require explicit fallback policy;
- preserve equivalent validation boundaries across providers;
- surface provider and execution-mode changes;
- fail closed where privacy or policy requires it.

### T12: Evidence and provenance confusion

**Description:** Generated artifacts, model identities, validator results, or approvals cannot be reliably attributed.

**Impact:** Silent drift, ambiguous review, replay failure, and unverifiable releases.

**Controls:**

- record spec, contract, model, policy, and validator identities;
- retain build and review metadata;
- generate SBOMs and release attestations;
- distinguish provenance from correctness or safety claims.

## Security Assumptions

The current design assumes:

- the application controls local inference configuration and model distribution;
- runtime AI output is untrusted until validated;
- build-time generation receives stronger review than device-time personalization;
- policy enforcement occurs outside the model;
- registry identity and validation remain authoritative;
- the mobile operating system and application sandbox are not perfect isolation boundaries;
- network fallback is explicit rather than implicit.

Changing any of these assumptions requires revisiting the threat model.

## Near-Term Hardening Priorities

1. strengthen model and registry integrity verification;
2. make overlay semantics and failure behavior fully explicit;
3. expand generated-source and package validation;
4. improve runtime validation observability and recovery;
5. define privacy, logging, retention, and fallback expectations;
6. make accessibility and design constraints machine-checkable;
7. add adversarial multimodal and resource-exhaustion test coverage;
8. improve replayable evidence for personalization and generation.

## Summary

The primary security property is the separation between:

```text
untrusted probabilistic capability
```

and:

```text
authoritative application behavior
```

Amaryllis is designed to preserve that separation across inference, context retrieval, component generation, personalization, registry resolution, and release workflows.
