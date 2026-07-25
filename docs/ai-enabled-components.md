# AI-enabled Components

This document explains the direction explored by the `feature/ai-components` branch.

The branch introduces a companion workspace, `@micrantha/amaryllis-components`, that explores how AI can participate in component systems without turning the runtime into an unrestricted code-generation environment.

The core idea is:

> Components remain declarative and authoritative while AI participates through bounded contracts.

---

# Motivation

Many current AI UI systems fall into one of two categories:

1. AI as a chat assistant attached to otherwise static UI
2. AI as an unrestricted source-code generator

The first approach limits adaptability.

The second approach creates serious problems for:

- governance
- reproducibility
- accessibility
- security
- design consistency
- runtime trust boundaries

This branch explores a middle path.

---

# Core Principle

The most important principle in this branch is:

```text
The spec is authoritative.
AI is a bounded implementation and personalization tool.
```

This changes the role of AI substantially.

Instead of:

```text
AI writes arbitrary UI
```

The architecture becomes:

```text
AI participates within constrained contracts
```

---

# Component Model

The companion module introduces a `ComponentSpec`.

The spec defines:

- component identity
- props
- UI structure
- allowed runtime behavior
- AI execution mode
- policy constraints
- generation contracts

The spec is intended to be:

- typed
- versioned
- reviewable
- enforceable
- portable

---

# AI Execution Modes

The RFC currently defines three major modes.

## Scaffold

AI helps generate implementation artifacts.

Typical environment:

- local tooling
- CI
- build pipelines

Typical outputs:

- TSX
- generated components
- implementation scaffolding

This mode assumes stronger validation and review controls.

---

## Customize

AI adapts or modifies bounded parts of a component.

Examples:

- choosing variants
- changing layout selections
- filling approved slots
- selecting design tokens

Customization is more constrained than unrestricted generation.

---

## Personalize

AI participates at runtime on device.

Examples:

- local summaries
- adaptive UI behavior
- slot text generation
- local variant selection
- bounded overlays

This mode is intentionally the most constrained.

---

# Why Local AI Matters

The base Amaryllis runtime already supports on-device multimodal inference.

That matters because AI-enabled components become much more useful when:

- latency is low
- network access is optional
- user data remains local
- multimodal state stays close to the UI
- offline interaction is possible

This is one reason the branch strongly separates:

```text
capability provider
```

from:

```text
hosted assistant service
```

---

# Runtime Safety Model

The runtime model in this branch is intentionally conservative.

At device time:

- AI output is treated as untrusted
- executable source generation is restricted
- overlays must be validated
- registries remain authoritative
- policies remain external to the model

This is a deliberate architectural choice.

The branch is attempting to support adaptive interfaces without implicitly trusting model output as executable runtime authority.

---

# Runtime Overlays

The runtime model prefers overlays rather than arbitrary mutation.

Examples:

- props updates
- slot text
- variant changes
- bounded JSON patches

This allows the system to preserve:

- component identity
- policy guarantees
- design consistency
- accessibility guarantees
- registry authority

while still allowing runtime adaptation.

---

# Registry-Centric Rendering

The branch leans toward a registry-centric rendering model.

Conceptually:

```text
ComponentSpec
  -> validation
  -> registry
  -> approved implementation
  -> runtime overlays
  -> render
```

This prevents the model from becoming the direct runtime source of executable UI.

---

# CopilotKit And AG-UI Fit

CopilotKit and AG-UI are useful integration surfaces for agent actions, shared frontend state, and generative UI orchestration.

Amaryllis should factor into those systems as a local-first capability and governance layer:

```text
agent action
  -> Amaryllis inference
  -> structured output
  -> ComponentSpec contract validation
  -> registry-approved render overlay
```

The companion package therefore exposes dependency-free adapter contracts rather than importing CopilotKit directly. This keeps CopilotKit/AG-UI optional while preserving the Amaryllis rule that model output is advisory until validation passes.

See [CopilotKit and AG-UI alignment](./copilotkit-ag-ui.md).

---

# Why This Direction Exists

The broader goal is not merely:

```text
React components with AI chat
```

The branch is exploring:

```text
Declarative, governable, AI-enabled interfaces
```

That includes:

- multimodal interactions
- local inference
- adaptive behavior
- bounded personalization
- spec-driven rendering
- reproducible generation workflows
- policy-aware runtime behavior

---

# Current State

This branch is exploratory.

Several parts are already present:

- `ComponentSpec` types
- JSON schema generation
- validation tooling
- policy engine primitives
- runtime overlay concepts
- CLI and generator scaffolding
- draft governance RFC

But many areas remain intentionally open:

- registry implementation details
- preview systems
- diff tooling
- approval workflows
- determinism guarantees
- runtime observability
- governance ergonomics

The current goal is to establish strong architectural boundaries before scaling the generation surface.
