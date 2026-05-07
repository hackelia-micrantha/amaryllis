# Concepts

This document defines the core terminology used throughout the `feature/ai-components` branch.

The goal is to establish a consistent mental model across:

- the base runtime
- the Context Engine
- the companion components workspace
- the RFC and governance model

---

# Base Runtime Concepts

## Runtime

The React Native-facing AI subsystem.

The runtime exposes:

- hooks
- providers
- controller APIs
- streaming interfaces
- context integration

The runtime is responsible for coordinating inference and interaction state.

---

## Controller

The controller is the direct interface to the native inference engine.

Examples:

- initialization
- session management
- synchronous generation
- streaming generation
- cancellation

The controller is lower-level than hooks or providers.

---

## Session

A session represents inference state that persists across requests.

Sessions are particularly important for multimodal workflows involving:

- images
- conversational continuity
- runtime personalization context

A session is not equivalent to a chat transcript.

---

## Context Engine

The Context Engine is an interface-first memory and retrieval layer.

It provides:

- retrieval
- bounded context augmentation
- validation hooks
- optional scoring
- storage abstraction

It does not:

- define component policy
- govern rendering authority
- replace the component registry

---

# Component Model Concepts

## ComponentSpec

The authoritative declarative definition of a component.

The spec defines:

- metadata
- props
- UI structure
- behavior constraints
- AI boundaries
- policy constraints
- generation contracts

The spec is authoritative.

AI output is not.

---

## Generation Contract

The generation contract defines:

- what AI may produce
- which formats are allowed
- how output is validated
- where execution is allowed

Examples:

- TSX generation
- props JSON
- variant selection
- JSON patch overlays

---

## Runtime Personalization

Runtime personalization means:

> AI influences rendered behavior without becoming the authoritative source of executable UI.

Typical outputs:

- props
- variants
- slot text
- bounded overlays

Runtime personalization is intentionally more constrained than build-time generation.

---

## Registry

The registry is the authoritative mapping between:

- component identity
- implementation identity
- spec identity
- runtime contract identity

The registry decides what is renderable.

The registry is not the model.

---

## Overlay

An overlay is a bounded runtime modification applied on top of an authoritative component contract.

Examples:

- variant selection
- slot text
- approved props updates
- limited JSON patch operations

Overlays must pass validation before rendering.

---

# AI Concepts

## Local AI

Inference executed on device.

Examples:

- MediaPipe-backed inference
- mobile multimodal sessions
- local summarization
- offline personalization

Local AI is a deployment characteristic, not a trust boundary.

---

## Capability Provider

A capability provider is a runtime capable of performing a bounded AI task.

Examples:

- image understanding
- summarization
- personalization
- variant selection
- slot generation

This branch intentionally thinks in terms of:

```text
AI capability providers
```

rather than:

```text
single assistant model
```

---

## Structured Output

Structured output is model output constrained to a schema or bounded contract.

Examples:

- JSON
- variant identifiers
- patch operations
- typed props

Structured output is preferred for runtime personalization because it is more governable than arbitrary source generation.

---

# Governance Concepts

## Policy

Policy defines what the system allows.

Examples:

- import restrictions
- runtime restrictions
- review requirements
- allowed operations
- forbidden operations

Policy is enforced outside the model.

---

## Validation

Validation is the process of confirming that:

- specs are well-formed
- outputs match contracts
- overlays stay within allowed bounds
- generated artifacts satisfy policy

Validation is central to the branch architecture.

---

## Authoritative Boundary

The authoritative boundary defines which subsystem has final control.

In this branch:

- the model is not authoritative
- specs and registries are authoritative
- runtime outputs must be validated before rendering

That distinction is the foundation of the branch’s governance model.
