# Amaryllis Components

## Adaptive React components, governed by spec

**Amaryllis Components** is a proposed companion module for building adaptive React interfaces on top of the Amaryllis on-device AI foundation.

The core idea is simple:

> The component spec is authoritative. AI operates inside declared constraints.

## Why it exists

Teams want AI-assisted UI without giving up reliability, accessibility, reviewability, or security. Amaryllis Components separates those concerns cleanly:

- **Amaryllis** handles on-device multimodal inference
- **Amaryllis Components** handles governed component specs, generation workflows, and bounded personalization

## What it enables

- **Spec-driven components** with typed, versioned contracts
- **Build-time generation** of component implementations from reviewed specs
- **Safe customization** through constrained variants, slots, and design tokens
- **On-device personalization** that returns validated data instead of executable UI code
- **Auditability** through provenance, validation, and diffable artifacts

## How it works

1. Define a component spec
2. Validate it against policy
3. Generate the implementation in a controlled build workflow
4. Review the resulting diff and preview
5. Publish a governed artifact
6. At runtime, allow only structured personalization outputs such as props, slot text, variants, or approved JSON patches

## Safety boundary

Runtime AI may help choose or fill component data, but it must not emit:

- TSX, JSX, JavaScript, or executable code
- Arbitrary imports or dependencies
- Raw markup
- Unbounded style values
- Policy or network-access changes

That keeps adaptive UI expressive without making runtime behavior opaque or unsafe.

## Who it is for

Amaryllis Components is for teams that want:

- AI-assisted frontend development
- stronger design-system adherence
- safer personalization
- traceable review workflows
- a path from experimentation to production governance

## Current status

This is currently a draft companion-module proposal. The detailed RFC defines the schema, operating modes, security model, and rollout path.

## Learn more

- [Read the full RFC](./amaryllis_ai_component_module_rfc.md)
- [View the Amaryllis repository](https://github.com/hackelia-micrantha/amaryllis)
