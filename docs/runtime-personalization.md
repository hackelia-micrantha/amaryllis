# Runtime Personalization

Runtime personalization allows AI to influence rendering through bounded structured output without becoming the authoritative source of executable UI.

> The registered component remains authoritative. Model output may only contribute data that passes its registered personalization contract.

## Why Runtime Personalization Exists

Adaptive mobile interfaces may need:

- local summaries;
- context-aware variants;
- multimodal reactions;
- user-specific slot content;
- bounded layout choices;
- accessibility-aware presentation changes.

Unrestricted runtime source generation creates governance drift, policy bypass, accessibility regressions, reproducibility loss, and arbitrary execution surfaces.

The personalization model preserves adaptive behavior while keeping product authority in application code and registered component implementations.

## Implemented Lifecycle

```text
component name
  -> registry lookup
  -> registered personalization contract
  -> AI invocation
  -> untrusted structured output
  -> JSON Schema and unsafe-key validation
  -> JSON Patch path, value, and post-patch validation
  -> bounded prop overlay
  -> registered component render
```

Rendering does not occur directly from raw model output.

The current runtime path validates data against the registered contract. It does not automatically execute the package's full `PolicyEngine` for every personalization call.

## Overlay Model

```text
authoritative base props
  + contract-validated personalization data
  = props passed to the registered implementation
```

The canonical `ComponentSpec`, registry entry, contract, and React implementation are not replaced by model output.

## Supported Runtime Data

The contract model can represent bounded forms such as:

- props JSON;
- known variant identifiers;
- declared slot text;
- declared design-token values;
- JSON Patch operations targeting declared personalization paths.

The exact fields and values accepted at runtime depend on the JSON Schema registered for the component.

## What the Runtime Does Not Execute

Device-time personalization is not interpreted as:

- JSX or TSX source;
- executable JavaScript;
- module imports;
- native code;
- arbitrary markup or style programs.

This prevents model output from directly becoming executable component code. It does not automatically prevent a validated prop value from triggering behavior already implemented by the application. Capability-bearing props, URLs, commands, or identifiers must therefore be constrained by the contract and component implementation.

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

A corresponding personalization contract might accept data such as:

```json
{
  "props": {
    "title": "Local summary"
  },
  "variant": "compact"
}
```

## Current Runtime Validation

`PersonalizationEngine.validate` currently performs:

- JSON Schema validation through AJV;
- unsafe object-key detection for `__proto__`, `constructor`, and `prototype`;
- JSON Patch path checks against declared `props`, `slots`, and `designTokens`, plus `variant`;
- unsafe patch-value detection;
- schema validation after patches are applied.

`PersonalizationEngine.apply` then merges accepted data into base props using a bounded recursive merge that ignores unsafe keys.

Registry registration separately verifies component name, version, optional hashes, and explicit replacement semantics.

## Policy Boundary

The package's `PolicyEngine` currently participates in build and CLI generation/customization flows. It is not automatically called by `PersonalizedComponent` when a component is registered programmatically.

Runtime applications that require network, capability, accessibility, review, or application-specific semantic policy must:

- encode enforceable limits in the personalization contract;
- keep sensitive capability decisions in reviewed component code;
- run additional application-level policy checks before applying personalization;
- treat schema validity as necessary but not sufficient for semantic safety.

## Failure Handling

When personalization data is invalid, `PersonalizedComponent`:

- rejects the personalization result;
- restores base props;
- exposes validation errors and diagnostics through an optional callback;
- can emit an optional console warning;
- renders only the already-registered implementation.

Applications decide whether to retry, show a static fallback, disable personalization, or invoke another provider. Remote fallback is not implicit in this component path.

## Context and Prompt Inputs

User input, media, retrieved context, and persisted memory are all untrusted. The validity of final output must not depend on the prompt or retrieval source being safe.

The Context Engine can provide bounded retrieval and attribution, but personalization output still passes through the registered contract.

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

CopilotKit and AG-UI may initiate personalization as frontend actions or render-tool flows. The adapter path remains:

```text
orchestration action
  -> inference function
  -> untrusted structured output
  -> PersonalizationEngine contract validation
  -> validated data for the registered component
```

Orchestration does not replace the registry or runtime contract. Additional policy enforcement remains an application responsibility unless explicitly composed into the adapter.

## Current Constraints and Future Work

The project is an active `0.1.x` implementation. Areas still evolving include:

- automatic runtime `PolicyEngine` composition;
- overlay replay and diff tooling;
- runtime observability and audit interfaces;
- rollback and conflict resolution;
- policy-version negotiation;
- approval workflows for promoted personalization;
- cryptographic model and registry identity evidence;
- privacy-safe telemetry.

The goal is not maximum generation flexibility. The goal is a stable, explicit, and testable runtime contract with accurately documented guarantees.