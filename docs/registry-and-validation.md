# Registry and Validation

This document explains the registry and validation direction for the `feature/ai-components` branch.

The core architectural principle is:

```text
The registry is authoritative.
Validation is mandatory.
Model output is advisory.
```

This document focuses on the runtime contract lifecycle rather than generation semantics.

---

# Why Registry-Centric Rendering Exists

Without an authoritative registry, runtime AI systems tend to drift toward:

- arbitrary runtime mutation
- hidden implementation changes
- unreviewed rendering behavior
- policy inconsistencies
- design-system fragmentation

The registry exists to preserve:

- component identity
- implementation authority
- policy attachment
- validation requirements
- rendering stability

---

# Registry Responsibilities

The registry is responsible for mapping:

```text
Component identity
  -> implementation
  -> spec
  -> validation contract
  -> runtime policy
```

The registry determines:

- what may render
- which variants are legal
- which overlays are legal
- which validators must run
- which runtime capabilities are allowed

The model cannot bypass the registry.

---

# Runtime Flow

At a high level:

```text
ComponentSpec
  -> registry lookup
  -> runtime AI invocation
  -> structured output
  -> validation pipeline
  -> overlay construction
  -> render
```

Validation sits between model output and rendering.

---

# Validation Pipeline

The branch currently leans toward layered validation.

Example:

```text
Schema validation
  -> policy validation
  -> accessibility validation
  -> token validation
  -> overlay validation
```

Each stage is intentionally explicit.

---

# Validation Categories

## Schema Validation

Confirms:

- required fields exist
- types are correct
- enums are bounded
- output structure is valid

Typical examples:

- props JSON
- variant identifiers
- patch operations

---

## Policy Validation

Confirms:

- forbidden operations are absent
- runtime restrictions are respected
- overlays stay within allowed paths
- execution mode rules are followed

---

## Accessibility Validation

Confirms:

- required labels exist
- contrast requirements are preserved
- slot behavior remains accessible
- runtime personalization does not remove required semantics

---

## Overlay Validation

Confirms:

- patch paths are legal
- component identity is preserved
- overlays remain bounded
- mutations do not escape the runtime contract

---

# Overlay Philosophy

The branch prefers:

```text
bounded overlays
```

instead of:

```text
arbitrary runtime mutation
```

This keeps:

- replayability simpler
- policy enforcement clearer
- rendering authority explicit
- validation deterministic

---

# Failure Handling

Validation failures should not silently degrade into unrestricted behavior.

Preferred failure modes:

- reject overlay
- log validator failure
- fall back to authoritative component
- preserve stable rendering

The runtime should fail closed where possible.

---

# Registry As A Security Boundary

The registry is also a security boundary.

It prevents:

- arbitrary component injection
- runtime implementation replacement
- unauthorized imports
- hidden executable generation

The model may influence rendering only through allowed contracts.

---

# Future Directions

Likely future registry capabilities include:

- signed manifests
- spec hashing
- overlay replay
- validator provenance
- approval workflows
- policy version negotiation
- runtime capability negotiation
- deterministic render manifests

The current goal is establishing strong architectural constraints before increasing runtime flexibility.
