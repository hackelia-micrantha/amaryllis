# Security Model

This document describes the security model for the `feature/ai-components` branch.

The branch combines:

- local multimodal inference
- AI-assisted component workflows
- runtime personalization
- declarative component contracts

Those capabilities create several important trust boundaries that should be explicit rather than implied.

This document is intentionally architectural rather than compliance-oriented.

---

# Core Security Principle

The most important principle in this branch is:

```text
AI output is not authoritative.
```

Instead:

- specs are authoritative
- registries are authoritative
- policy is authoritative
- validation is authoritative

AI is treated as a bounded capability provider operating inside those constraints.

This principle drives most of the branch’s design decisions.

---

# Major Trust Boundaries

## 1. Model Output Boundary

Model output is treated as untrusted until validated.

This applies to:

- generated source
- personalization overlays
- props JSON
- slot content
- patch operations
- multimodal responses

The runtime should never assume:

```text
model output == safe executable UI
```

---

## 2. Runtime Authority Boundary

The runtime renderer is authoritative.

The model does not:

- directly control rendering
- bypass validation
- mutate authoritative specs
- replace registry entries
- escalate runtime permissions

Instead, model output flows through:

```text
structured output
  -> validation
  -> overlay
  -> render
```

---

## 3. Registry Boundary

The registry binds:

- component identity
- spec identity
- runtime contract identity
- implementation identity

The registry determines what implementations are renderable.

The model cannot directly introduce new executable implementations at runtime.

---

## 4. Policy Boundary

Policy exists outside the model.

The model may attempt to produce outputs that violate policy.

Validation and enforcement layers are responsible for:

- import restrictions
- runtime restrictions
- overlay restrictions
- accessibility requirements
- generation constraints
- review requirements

This prevents the model from becoming the effective policy authority.

---

# Threat Surfaces

## Prompt Injection

Potential vectors:

- user prompts
- multimodal inputs
- retrieved context
- slot content
- persisted personalization data

Potential impacts:

- unauthorized overlays
- policy bypass attempts
- generation manipulation
- data exfiltration attempts

Mitigations:

- structured output
- bounded schemas
- overlay validation
- policy enforcement
- explicit runtime contracts

---

## Arbitrary Source Generation

Unrestricted runtime JSX or TSX generation creates:

- arbitrary execution risk
- import injection risk
- policy bypass risk
- accessibility regressions
- unreviewed runtime behavior

The branch intentionally restricts device-time generation.

Runtime personalization should prefer:

- props JSON
- variants
- slot text
- bounded patch overlays

rather than executable source.

---

## Multimodal Input Risks

Image and multimodal systems create additional attack surfaces:

- malformed media
- oversized payloads
- adversarial image content
- memory pressure attacks
- hidden prompt content
- data extraction attempts

The runtime therefore constrains:

- file handling
- image sizing
- URI handling
- session usage
- runtime memory behavior

---

## Overlay Escalation

A personalization overlay should never become an unrestricted mutation surface.

Risks include:

- modifying policy
- changing imports
- replacing layouts
- introducing executable content
- bypassing registry controls

The RFC therefore constrains overlay paths and output formats.

---

# Build-Time vs Device-Time Security

The branch intentionally distinguishes:

## Build-time / CI generation

Potentially allows:

- TSX generation
- implementation scaffolding
- larger transformations

But requires:

- validation
- review
- provenance
- policy enforcement
- artifact tracking

---

## Device-time personalization

Much more constrained.

The device-time model assumes:

- runtime AI is probabilistic
- runtime output is untrusted
- rendering boundaries must remain stable
- policy enforcement must remain external

This is why the branch heavily prefers structured outputs over executable source.

---

# Local AI Security Characteristics

Local inference changes the threat model.

Benefits:

- reduced network exposure
- stronger privacy boundaries
- offline operation
- local multimodal processing
- reduced hosted-data dependency

Tradeoffs:

- device resource pressure
- model distribution concerns
- local model tampering risk
- client-side trust assumptions
- reverse-engineering exposure

Local AI is not automatically “secure.”

It simply shifts where trust and exposure exist.

---

# Validation Responsibilities

Validation is one of the most important security mechanisms in the branch.

Validation responsibilities include:

- schema validation
- patch validation
- variant validation
- slot validation
- import restrictions
- runtime restrictions
- policy enforcement
- accessibility checks
- design-token enforcement

Validation should remain deterministic even when generation is probabilistic.

---

# Provenance And Replay

The branch also moves toward stronger provenance and replay semantics.

Potential provenance artifacts include:

- spec hashes
- contract hashes
- model identity
- validator results
- generation metadata
- review metadata

This helps reduce:

- silent drift
- untracked generation
- review ambiguity
- runtime inconsistency

---

# Explicit Non-Goals

The current direction is intentionally not:

- unrestricted runtime code generation
- autonomous runtime UI mutation
- implicit model trust
- hidden policy enforcement
- unrestricted runtime imports
- opaque personalization behavior

The branch instead prioritizes:

- bounded adaptation
- explicit contracts
- validation
- local-first execution
- runtime governance
- declarative rendering boundaries

---

# Future Security Areas

Several areas remain open for future work:

- overlay replayability
- runtime observability
- signed registry manifests
- attestation of generated artifacts
- policy version negotiation
- secure model distribution
- capability isolation
- multimodal red-team corpora
- runtime audit logging

The current focus is establishing stable boundaries before increasing generation flexibility.
