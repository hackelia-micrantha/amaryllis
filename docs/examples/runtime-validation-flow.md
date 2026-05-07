# Runtime Validation Flow Example

This document shows an example end-to-end runtime personalization flow.

The goal is to demonstrate how:

- local AI
- structured output
- validation
- overlays
- rendering

fit together operationally.

---

# 1. Authoritative Spec

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

ai:
  mode: personalize
  execution: device
  generationContract:
    output: props-json
```

---

# 2. Registry Resolution

The runtime resolves:

```text
SummaryCard
  -> approved implementation
  -> active policy
  -> validator pipeline
  -> runtime contract
```

The registry decides what implementation is renderable.

---

# 3. Runtime AI Invocation

The local model receives a bounded prompt.

Conceptually:

```json
{
  "task": "summarize",
  "constraints": {
    "maxLength": 240,
    "variants": ["compact", "expanded"]
  }
}
```

The model is not asked to generate executable JSX.

---

# 4. Structured Output

Example model output:

```json
{
  "summary": "Short offline summary",
  "variant": "compact"
}
```

This output is still treated as untrusted.

---

# 5. Schema Validation

The validator confirms:

- fields exist
- output types match
- variant enum is valid
- summary length is bounded

Failure example:

```json
{
  "variant": "fullscreen-admin-shell"
}
```

This should fail validation.

---

# 6. Policy Validation

Policy validators confirm:

- no forbidden operations exist
- no executable content exists
- overlays remain within approved boundaries
- runtime restrictions are preserved

---

# 7. Overlay Construction

Validated output becomes an overlay.

Conceptually:

```json
{
  "overlay": {
    "variant": "compact",
    "slots": {
      "summary": "Short offline summary"
    }
  }
}
```

The overlay is bounded and typed.

---

# 8. Rendering

Rendering occurs through:

```text
authoritative component
  + validated overlay
  = final render
```

The runtime implementation remains authoritative.

---

# Failure Behavior

If validation fails:

```text
reject overlay
  -> log validator result
  -> fall back to authoritative component
```

The runtime should not silently escalate privileges or disable validation.

---

# Why This Matters

This flow preserves several important properties:

- runtime flexibility
- offline personalization
- deterministic validation
- explicit trust boundaries
- stable rendering authority
- bounded mutation surfaces

The branch intentionally prioritizes these properties over unrestricted runtime generation.
