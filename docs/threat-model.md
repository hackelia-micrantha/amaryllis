# Threat Model

This document describes the primary threat surfaces for the `feature/ai-components` branch.

It covers both:

- the base Amaryllis runtime for local multimodal inference
- the `@micrantha/amaryllis-components` companion workspace

The goal is not to be exhaustive. The goal is to establish a clear security model for the current architecture and to make the intended controls explicit.

---

## Security Posture

The branch is intentionally designed around a conservative rule:

> Model output is not authoritative.

That rule leads to three important consequences:

1. runtime AI output is treated as untrusted until validated
2. component specs and registries remain authoritative
3. device-time AI is bounded to structured outputs rather than unrestricted executable UI generation

This is the core security position of the branch.

---

## Assets

Important assets include:

- model files on device
- prompts and context inputs
- user-provided media
- component specs
- runtime personalization outputs
- generated source artifacts
- policy definitions
- registry entries and implementation identities
- application secrets and network credentials

Not all of these assets have the same sensitivity, but they all participate in the trust model.

---

## Trust Boundaries

### Boundary 1: App input -> inference runtime

User text, media, and app context cross into the inference subsystem.

Key risks:

- prompt injection
- oversized or malformed media
- resource exhaustion
- unexpected multimodal behavior

### Boundary 2: model output -> personalization/runtime layer

Model output crosses into application-controlled rendering logic.

Key risks:

- invalid structured output
- policy violations
- overlay drift
- hidden capability escalation

### Boundary 3: spec/generator -> generated artifact

Build-time generation crosses into source artifacts or derived runtime contracts.

Key risks:

- unsafe imports
- hidden sinks
- design-system drift
- accessibility regressions
- provenance loss

### Boundary 4: registry -> rendered component

The runtime decides what implementation is actually renderable.

Key risks:

- spec/implementation mismatch
- stale or replaced identities
- unauthorized overrides
- unreviewed component substitutions

---

## Threat Categories

## T1: Prompt Injection

### Description

User-controlled or retrieved content attempts to alter model behavior outside intended component or inference boundaries.

### Examples

- a slot content source attempts to override the personalization contract
- retrieved memory tells the model to emit fields outside the schema
- multimodal input contains text intended to steer behavior away from policy

### Controls

- keep specs authoritative
- validate runtime output against schemas
- treat retrieved context as untrusted input
- separate prompt formatting from rendering authority
- keep policy enforcement outside the model

---

## T2: Arbitrary Runtime Code Generation

### Description

A device-time model attempts to produce executable JSX, TSX, JavaScript, imports, or markup that would become authoritative UI logic.

### Impact

- capability escalation
- hidden behavior injection
- unreviewed network access
- XSS-like rendering hazards
- loss of governance and reproducibility

### Controls

- do not allow runtime source generation as the default path
- restrict device-time outputs to structured data
- require validation before rendering
- keep registry-managed implementations authoritative

---

## T3: Policy Bypass Through Structured Output

### Description

Even when output is structured, the model may attempt to smuggle behavior through allowed fields.

### Examples

- patching disallowed paths
- setting fields that indirectly trigger unsafe behavior
- attempting token or slot values outside approved sets

### Controls

- allowlist patch paths
- constrain slot names and variant IDs
- validate enums and token selections strictly
- reject overlays that modify authoritative policy or target fields

---

## T4: Registry Integrity Failure

### Description

The runtime renders a component whose implementation identity does not match the expected spec or contract.

### Impact

- unauthorized substitutions
- stale implementations
- review bypass
- inconsistent runtime behavior

### Controls

- bind registry entries to spec and contract identities
- reject mismatched registration attempts
- require explicit replacement semantics
- keep authoritative identities versioned

---

## T5: Generated Source Abuse

### Description

Build-time or CI-time generation produces unsafe source artifacts.

### Examples

- unsafe imports
- dynamic code execution
- raw markup sinks
- undeclared capabilities
- hidden persistence or network behavior

### Controls

- source validation after generation
- import allowlists and denylists
- ban dynamic execution sinks
- require human review for executable artifacts
- record provenance and review metadata

---

## T6: Media Input Resource Exhaustion

### Description

Large or malformed image inputs cause memory pressure, CPU exhaustion, or runtime instability.

### Impact

- crashes
- degraded UX
- denial of service
- unpredictable inference failures

### Controls

- file size limits
- URI restrictions
- resizing and preprocessing
- bounded image counts
- graceful failure handling

---

## T7: Context Poisoning

### Description

The Context Engine or retrieval layer returns misleading or hostile data that influences model output in unsafe ways.

### Impact

- policy drift
- invalid personalization
- degraded relevance
- indirect prompt injection

### Controls

- treat retrieved context as untrusted
- bound retrieval and formatting
- validate runtime outputs independently of context source
- avoid equating provenance with safety

---

## T8: Privacy Boundary Erosion

### Description

A local-first system unintentionally leaks prompts, media, or personalization data through logs, network fallbacks, or generated artifacts.

### Impact

- user privacy loss
- policy violations
- enterprise data handling failures

### Controls

- keep network behavior application-controlled
- document local-first assumptions clearly
- avoid implicit remote execution
- minimize sensitive logging
- separate local personalization from publishable artifacts

---

## T9: Accessibility and Design Drift

### Description

AI-assisted generation or personalization produces outputs that are technically valid but violate accessibility or design constraints.

### Impact

- inconsistent UX
- accessibility regressions
- degraded maintainability
- weakened product governance

### Controls

- encode accessibility and design rules in policy
- validate token usage and runtime choices
- preserve registry-controlled base implementations
- keep overlays bounded to approved dimensions

---

## T10: Deep Merge / Overlay Corruption

### Description

Runtime personalization modifies nested structures in unsafe or unexpected ways.

### Impact

- broken components
- state corruption
- policy bypass through structural ambiguity

### Controls

- define overlay semantics precisely
- prefer explicit patch schemas over ad hoc object merges
- validate overlay paths and value types
- treat merge behavior as part of the security boundary

---

## Security Assumptions

This branch currently assumes:

- local inference is available and under application control
- runtime AI output is untrusted until validated
- build-time generation is subject to stronger review controls than device-time personalization
- policy enforcement happens outside the model
- registry identity and validation remain authoritative

If any of these assumptions change, the threat model must be revisited.

---

## Near-Term Hardening Priorities

The highest-value hardening work for this branch is:

1. formalize registry identity and replacement rules
2. define overlay semantics more precisely than shallow object merging
3. add generated-source validation for build and CI outputs
4. make runtime validation failures observable and recoverable
5. document explicit privacy and logging expectations for local-first operation
6. ensure accessibility and design-token constraints are machine-checkable

---

## Summary

The branch is attempting to support AI-enabled interfaces without collapsing the boundary between:

```text
untrusted model output
```

and

```text
authoritative UI behavior
```

That separation is the primary security property of the architecture.
