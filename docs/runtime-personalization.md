# Runtime Personalization

This document describes the runtime personalization model explored by the `feature/ai-components` branch.

The central idea is:

> Runtime AI may influence rendering through bounded overlays and structured outputs, but it does not become the authoritative source of executable UI.

This distinction is fundamental to the branch architecture.

---

# Why Runtime Personalization Exists

Many adaptive interfaces need some degree of runtime intelligence.

Examples:

- local summaries
- adaptive layouts
- multimodal reactions
- user-specific slot content
- context-aware variants
- accessibility-aware presentation changes

However, unrestricted runtime code generation creates severe problems:

- governance drift
- runtime trust collapse
- accessibility regressions
- policy bypass
- reproducibility loss
- arbitrary execution surfaces

The runtime personalization model exists to preserve adaptive behavior while maintaining explicit system boundaries.

---

# Personalization Lifecycle

At a high level:

```text
ComponentSpec
  -> runtime contract
  -> AI invocation
  -> structured output
  -> validation
  -> overlay generation
  -> render
```

The important detail is that rendering happens through validated overlays, not directly from raw model output.

---

# Runtime Overlay Model

The branch currently leans toward overlays rather than arbitrary mutation.

Conceptually:

```text
Authoritative component
  + validated overlay
  = rendered output
```

The authoritative component remains stable.

The overlay is bounded.

---

# Allowed Runtime Outputs

The RFC currently identifies several acceptable runtime output forms:

- props JSON
- variant selection
- slot text
- bounded JSON patch operations

These outputs are easier to:

- validate
- audit
- constrain
- replay
- reason about

than arbitrary executable source.

---

# Forbidden Runtime Outputs

The runtime model intentionally rejects:

- arbitrary JSX
- arbitrary TSX
- executable JavaScript
- unrestricted imports
- unrestricted native access
- arbitrary style injection
- unrestricted network access

This is not merely a convenience restriction.

It is a core architectural boundary.

---

# Example Runtime Flow

## 1. Authoritative Spec

```yaml
apiVersion: amaryllis/v1alpha1
kind: ComponentSpec

metadata:
  name: SummaryCard
  version: 0.1.0

target:
  framework: react
  runtime: rn

props:
  type: object
  properties:
    title:
      type: string

ui:
  slots:
    - summary

ai:
  mode: personalize
  execution: device
  generationContract:
    output: props-json
```

---

## 2. Runtime Invocation

The runtime asks the local model for structured output.

Conceptually:

```json
{
  "summary": "Short local summary",
  "variant": "compact"
}
```

---

## 3. Validation

The runtime validates:

- schema shape
- allowed variants
- slot boundaries
- policy restrictions
- token restrictions

If validation fails, rendering falls back to the authoritative component.

---

## 4. Overlay Application

A bounded overlay is applied:

```text
base component
  + validated runtime overlay
  = final render
```

The canonical `ComponentSpec` remains unchanged.

---

# Registry Interaction

The branch architecture assumes the registry remains authoritative.

Conceptually:

```text
registry
  -> approved component implementation
  -> spec identity
  -> runtime contract identity
```

Runtime AI output cannot replace the registry.

It can only provide bounded overlays within the approved contract.

---

# Why Structured Output Matters

Structured outputs are easier to govern because:

- schemas are enforceable
- validation is deterministic
- replayability improves
- review tooling becomes possible
- runtime safety boundaries are clearer

This is one reason the branch strongly prefers:

```text
props-json
variant-selection
json-patch
```

instead of unrestricted runtime source generation.

---

# Relationship To Local AI

The personalization model fits naturally with local inference.

Benefits include:

- lower latency
- offline adaptation
- local multimodal context
- stronger privacy boundaries
- reduced network dependency

This is especially important for mobile UI flows where interaction timing and responsiveness matter.

---

# Future Directions

Several runtime personalization areas remain open:

- replay and observability
- overlay diff tooling
- personalization telemetry
- rollback behavior
- runtime policy hot reloads
- conflict resolution
- approval workflows for promoted overlays

The current goal is not maximum generation flexibility.

The current goal is establishing a strong runtime contract model first.
