# Registry and Validation

The registry and validation pipeline preserve executable ownership when AI participates in component generation or runtime personalization.

```text
The registry is authoritative.
Validation is mandatory.
Model output is advisory.
```

This document focuses on runtime contract resolution and validation rather than generation prompts or model behavior.

## Why Registry-centric Rendering Exists

Without an authoritative registry, AI-enabled UI can drift toward:

- arbitrary runtime mutation;
- hidden implementation replacement;
- unreviewed rendering behavior;
- inconsistent policy attachment;
- design-system fragmentation;
- ambiguous version and contract identity.

The registry preserves component identity, implementation authority, validation requirements, and rendering stability.

## Registry Responsibilities

A registry entry binds:

```text
component identity
  -> version
  -> implementation identity
  -> ComponentSpec identity
  -> generation or runtime contract
  -> validators and policy
```

The registry determines:

- what implementation may render;
- which specification and contract versions apply;
- which variants, slots, props, and overlays are legal;
- which validators must run;
- which runtime capabilities are allowed;
- how replacement or upgrade semantics work.

The model cannot bypass or mutate the registry.

## Runtime Flow

```text
ComponentSpec
  -> registry lookup
  -> contract and implementation resolution
  -> AI invocation
  -> untrusted structured output
  -> validation pipeline
  -> bounded overlay
  -> render
```

Validation sits between probabilistic output and authoritative rendering.

## Validation Pipeline

Validation is layered so each concern remains explicit and testable.

```text
identity and version checks
  -> schema validation
  -> policy validation
  -> accessibility and design validation
  -> overlay validation
  -> render eligibility
```

Unknown identities, schema versions, operations, or capabilities should fail closed.

## Validation Categories

### Identity and version validation

Confirms:

- the component is registered;
- spec, contract, and implementation identities match;
- versions are compatible;
- replacement semantics are explicit;
- the requested runtime mode is supported.

### Schema validation

Confirms:

- required fields exist;
- types and formats are correct;
- enums are bounded;
- output structure matches the declared contract;
- additional fields are rejected where appropriate.

Typical outputs include props JSON, variant identifiers, slot values, and patch operations.

### Policy validation

Confirms:

- forbidden operations are absent;
- runtime and network restrictions are respected;
- overlay paths stay within allowlists;
- imports and capabilities remain within declared bounds;
- execution-mode and review requirements are satisfied.

Policy is deterministic and external to the model.

### Accessibility and design validation

May confirm:

- required labels and semantics remain present;
- runtime output cannot remove critical accessibility behavior;
- only approved design tokens and variants are used;
- generated source passes applicable accessibility checks;
- contrast and interaction constraints remain satisfied.

Some checks require source, rendered output, or platform-specific testing and cannot be proven from schema validation alone.

### Overlay validation

Confirms:

- patch paths and operations are legal;
- value types satisfy the target schema;
- component and contract identity are preserved;
- mutations cannot alter policy, imports, capabilities, or implementation identity;
- overlays remain bounded and replayable.

Explicit patch contracts are preferred over ambiguous recursive object merging.

### Generated-source validation

Build-time executable output may require:

- import allowlists and sink denylists;
- formatting, lint, and type checking;
- unit, integration, and accessibility tests;
- package and entrypoint validation;
- human diff review;
- provenance and approval evidence.

Passing source validation does not make generated behavior inherently correct; it makes the result reviewable through normal engineering controls.

## Failure Handling

Validation failures must not silently degrade into unrestricted behavior.

Preferred behavior is to:

- reject the invalid output or complete overlay;
- return typed failure details;
- preserve the authoritative base component;
- avoid partial application unless the contract explicitly supports atomic subsets;
- avoid implicit provider or network fallback;
- record enough evidence for diagnosis without leaking sensitive prompts or context.

The runtime should fail closed where policy, identity, or capability boundaries are uncertain.

## Registry as a Security Boundary

The registry prevents:

- arbitrary component injection;
- runtime implementation replacement;
- spec and implementation mismatch;
- unauthorized imports and capabilities;
- hidden executable generation;
- silent contract drift.

The model may influence rendering only through a contract attached to a known registry entry.

## Provenance

Useful registry and validation evidence may include:

- component, spec, contract, and implementation identifiers;
- hashes and versions;
- policy and validator versions;
- model and provider identity;
- raw and normalized output digests;
- validation results;
- review and approval metadata;
- generated package SBOMs and release attestations.

Provenance supports attribution and replay. It is not a substitute for policy or correctness checks.

## Current Constraints and Future Work

The repository contains working registry, schema, policy, and personalization primitives, but remains an active `0.1.x` implementation.

Likely future work includes:

- signed registry manifests;
- stronger spec and contract hashing;
- overlay replay and diff tooling;
- validator provenance and compatibility negotiation;
- explicit migration and replacement workflows;
- runtime capability negotiation;
- deterministic render manifests;
- observability and audit interfaces.

The immediate priority is preserving strong identity and validation boundaries before increasing runtime flexibility.
