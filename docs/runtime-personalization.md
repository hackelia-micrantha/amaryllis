# Runtime Personalization

Runtime personalization allows AI to influence rendering through bounded structured output without becoming the authoritative source of executable UI.

> The authoritative component remains stable. Model output may only produce a validated overlay within its declared contract.

## Why Runtime Personalization Exists

Adaptive mobile interfaces may need:

- local summaries;
- context-aware variants;
- multimodal reactions;
- user-specific slot content;
- bounded layout choices;
- accessibility-aware presentation changes.

Unrestricted runtime source generation creates governance drift, policy bypass, accessibility regressions, reproducibility loss, and arbitrary execution surfaces.

The personalization model preserves adaptive behavior while keeping product authority in deterministic application code.

## Lifecycle

```text
ComponentSpec
  -> registry and runtime contract
  -> AI invocation
  -> untrusted structured output
  -> schema validation
  -> policy validation
  -> bounded overlay
  -> registry-approved render
```

Rendering never occurs directly from raw model output.

## Overlay Model

```text
authoritative component
  + validated overlay
  = rendered output
```

The overlay may affect only dimensions declared by the component contract. The canonical `ComponentSpec`, policy, registry identity, and implementation remain unchanged.

## Allowed Runtime Outputs

The current contract model supports bounded forms such as:

- props JSON;
- known variant identifiers;
- declared slot text;
- allowlisted JSON patch operations.

These forms are easier to validate, audit, replay, and reason about than executable source.

## Forbidden Runtime Outputs

Device-time personalization does not accept:

- arbitrary JSX or TSX;
- executable JavaScript;
- unrestricted imports;
- arbitrary native access;
- unconstrained style or markup injection;
- implicit network access;
- changes to specification, policy, identity, or registry fields.

This is a security and governance boundary, not only an API convenience.

## Example Contract

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

A model might return:

```json
{
  "summary": "Short local summary",
  "variant": "compact"
}
```

The runtime then validates:

- schema shape and types;
- component and contract identity;
- allowed variants and slots;
- patch paths and operations;
- design-token and capability restrictions;
- applicable policy rules.

If validation fails, the overlay is rejected and the application falls back to the authoritative component or another explicit safe state.

## Registry Interaction

The registry remains authoritative over:

- component identity;
- implementation identity;
- spec and contract versions;
- legal variants and overlays;
- required validators and policy.

Runtime model output cannot replace a registry entry or introduce a new implementation. It can only propose data within the approved contract.

## Failure Handling

Validation failures should be observable and recoverable.

Preferred behavior includes:

- reject the complete invalid overlay;
- preserve stable base rendering;
- return typed failure information;
- avoid silent coercion or capability expansion;
- prevent implicit remote fallback;
- record enough evidence to diagnose contract, model, or policy mismatches.

Applications decide whether to retry, use a static fallback, or disable personalization.

## Context and Prompt Inputs

User input, media, retrieved context, and persisted memory are all untrusted. The validity of final output must not depend on the prompt or retrieval source being safe.

The Context Engine may provide attribution and bounded retrieval, but output still passes through the same validation boundary.

## Local Inference

Runtime personalization fits naturally with on-device inference because it can provide low latency, offline behavior, and application-controlled network use.

Local execution does not eliminate:

- client compromise;
- model or adapter tampering;
- resource exhaustion;
- sensitive logging or persistence;
- privacy leakage through application fallback;
- probabilistic or adversarial model behavior.

## CopilotKit and AG-UI

CopilotKit and AG-UI may initiate personalization as frontend actions or render-tool flows, but they do not bypass Amaryllis contracts.

The adapter path remains:

```text
orchestration action
  -> inference function
  -> untrusted structured output
  -> PersonalizationEngine validation
  -> validated data for rendering
```

This keeps orchestration optional while preserving local inference, registry, policy, and validation authority.

## Current Constraints and Future Work

The project is an active `0.1.x` implementation. Areas still evolving include:

- overlay replay and diff tooling;
- runtime observability and audit interfaces;
- rollback and conflict resolution;
- policy-version negotiation;
- approval workflows for promoted personalization;
- stronger model and registry identity evidence;
- privacy-safe telemetry.

The goal is not maximum generation flexibility. The goal is a stable, explicit, and testable runtime contract.
