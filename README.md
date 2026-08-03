# Amaryllis

![Amaryllis](docs/amaryllis-128.png)

[![npm version](https://img.shields.io/npm/v/@micrantha/react-native-amaryllis.svg)](https://www.npmjs.com/package/@micrantha/react-native-amaryllis)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Amaryllis Hippeastrum** symbolizes hope and emergence, blooming even in difficult conditions.

Amaryllis is an open-source React Native foundation for on-device multimodal AI. It combines native Android and iOS inference, streaming interaction, offline-first context interfaces, and a companion component system for governed AI-enabled UI.

The project is an active `0.1.x` implementation. APIs and model integration details may evolve while the core trust boundaries are stabilized.

## Why Amaryllis

Mobile AI often forces a poor choice between a thin hosted assistant and unrestricted generated UI. Amaryllis explores a more controlled model:

- inference can remain on device;
- application code owns model selection, lifecycle, storage, rendering, and fallback behavior;
- model output is treated as untrusted input;
- registered component implementations and runtime contracts remain authoritative;
- runtime personalization uses bounded structured data rather than executable JSX or TSX;
- broader semantic and capability policy remains explicit rather than hidden inside the model.

## Architecture

The repository contains three related layers:

1. **On-device runtime**
   - native model execution on Android and iOS;
   - React Native provider, hooks, and controller APIs;
   - streaming output, cancellation, image inputs, and typed errors.

2. **Context Engine**
   - interface-first memory and retrieval;
   - application-owned storage;
   - bounded retrieval, TTL policy, validation, and optional scoring.

3. **Amaryllis Components**
   - typed and versioned `ComponentSpec` contracts;
   - specification schema and policy primitives;
   - generation, registry, and packaging primitives;
   - bounded runtime personalization;
   - JSON Schema, unsafe-key, and JSON Patch validation.

```text
Application UI and product logic
  -> application policy, lifecycle, and fallback
  -> Amaryllis provider / hooks / controller
  -> native Android and iOS inference
  -> application-selected model assets

Build and CLI component flow
  ComponentSpec
    -> schema and policy validation
    -> generated or customized artifacts
    -> normal review and delivery controls

Runtime personalization flow
  registered component and contract
    -> untrusted structured output
    -> schema, unsafe-key, and patch validation
    -> bounded prop overlay
    -> registered implementation render
```

The model is a capability provider, not the authority over application behavior.

## Installation

```sh
npm install @micrantha/react-native-amaryllis
# or
yarn add @micrantha/react-native-amaryllis
# or
pnpm add @micrantha/react-native-amaryllis
```

The companion package is developed in the same workspace:

```sh
yarn workspace @micrantha/amaryllis-components build
```

## Requirements

- React Native and React as peer dependencies;
- Node.js 24 for repository development, as defined by `.nvmrc`;
- React 18 or newer for `@micrantha/amaryllis-components`.

## Compatibility

| Area | Current repository coverage |
| --- | --- |
| React Native | Tested with the repository's pinned React Native version |
| Android | Example application built in CI |
| iOS | Example application built in CI with Xcode 16.4 |
| Node.js | Compatibility checks on Node.js 20, 22, and 24 |
| Components | Included as `@micrantha/amaryllis-components` |

Compatibility coverage is evidence for the tested repository configuration, not a promise that every device, model, or React Native combination is supported.

## Runtime Quickstart

Wrap the application with `LLMProvider` and provide application-managed model paths:

```tsx
import { LLMProvider } from '@micrantha/react-native-amaryllis';

<LLMProvider
  config={{
    modelPath: 'gemma3-1b-it-int4.task',
    visionEncoderPath: 'mobilenet_v3_small.tflite',
    visionAdapterPath: 'mobilenet_v3_small.tflite',
    maxTopK: 32,
    maxNumImages: 2,
    maxTokens: 512,
  }}
>
  <App />
</LLMProvider>;
```

Use `useInferenceAsync` for streaming generation:

```tsx
import { useInferenceAsync } from '@micrantha/react-native-amaryllis';

const generate = useInferenceAsync({
  onResult: (text, isFinal) => {
    // Hook results are cumulative snapshots. Replace displayed text.
    setOutput(text);
    if (isFinal) finish();
  },
  onError: handleError,
  onComplete: handleComplete,
});

const cancel = await generate({ prompt, images });
```

`await generate(...)` waits for validation and native startup, not for model completion. Use `onComplete` or the final `onResult(..., true)` callback as the terminal boundary. The returned cancellation function targets only that request and is idempotent.

Asynchronous generation is single-flight per native module. An overlapping synchronous or asynchronous request is rejected with `GenerationInProgressError` and code `GENERATION_IN_PROGRESS`; it is not queued and does not cancel the active request.

Applications should cancel active work during lifecycle cleanup and bound image count, image size, and token budgets for predictable resource use. See [Asynchronous inference lifecycle](docs/async-inference.md) and the [sequential generation example](docs/examples/sequential-async-inference.md).

## Context Engine

The Context Engine provides memory and retrieval without imposing a hosted storage dependency. Applications supply a `ContextStore`, such as SQLite, files, or another database.

```ts
import { ContextEngine } from '@micrantha/react-native-amaryllis/context';

const engine = new ContextEngine({
  store: myStore,
  policy: {
    maxItems: 1000,
    defaultTtlSeconds: 60 * 60 * 24,
  },
});

await engine.add([
  { id: 'memory-1', text: 'Quest started', createdAt: Date.now() },
]);

const results = await engine.search({ text: 'quest', limit: 5 });
```

Retrieved context remains untrusted input. Output validation must not depend on the context source being safe.

## Governed Components

`@micrantha/amaryllis-components` defines a spec-driven component model with three modes:

- **Scaffold:** generate reviewable source at build or CI time;
- **Customize:** produce bounded variants within declared layouts, slots, tokens, and imports;
- **Personalize:** return contract-validated props, variants, slot text, design-token values, or constrained JSON patches at runtime.

```ts
import { parseSpec } from '@micrantha/amaryllis-components/dist/parser/yaml';

const spec = parseSpec(`
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
`);
```

Runtime AI cannot directly register implementations, mutate authoritative specs, or introduce executable imports. The current runtime path validates against the registered JSON contract and patch bounds.

The full package `PolicyEngine` is currently applied by build and CLI generation/customization flows, not automatically by every programmatic `PersonalizedComponent` call. Applications must compose additional policy for network access, sensitive capabilities, semantic business rules, accessibility, and data handling where required.

## Security Model

The central security principle is:

```text
AI output is not authoritative.
```

Implemented runtime controls include:

- registry lookup of a reviewed implementation and contract;
- JSON Schema validation;
- unsafe prototype-related key detection;
- JSON Patch path and value validation;
- post-patch schema validation;
- fallback to base props on validation failure.

Build and CLI workflows provide separate specification-policy and generated-artifact controls.

Local inference reduces some network exposure, but it does not eliminate client compromise, reverse engineering, malicious model assets, resource exhaustion, or privacy leakage through application logging and fallback behavior.

See [Security Model](docs/security-model.md), [Threat Model](docs/threat-model.md), and [Registry and validation](docs/registry-and-validation.md).

## Delivery and Supply Chain

The repository includes production-minded delivery controls such as:

- lint, tests, type checking, and native builds;
- compatibility matrices;
- package metadata and entrypoint validation;
- change-aware CI gating;
- repository and package-scoped CycloneDX SBOMs;
- release provenance and artifact attestation workflows.

These controls improve reviewability and traceability; they do not replace application-specific security review or device testing.

## Documentation

- [Architecture](docs/architecture.md)
- [Concepts](docs/concepts.md)
- [Local AI and MediaPipe](docs/local-ai.md)
- [Asynchronous inference lifecycle](docs/async-inference.md)
- [Context Engine](docs/context-engine.md)
- [AI-enabled components](docs/ai-enabled-components.md)
- [Runtime personalization](docs/runtime-personalization.md)
- [Registry and validation](docs/registry-and-validation.md)
- [CopilotKit and AG-UI alignment](docs/copilotkit-ag-ui.md)
- [Security model](docs/security-model.md)
- [Threat model](docs/threat-model.md)
- [Amaryllis Components RFC](docs/amaryllis_ai_component_module_rfc.md)
- [Examples](docs/examples)
- [Development workflow](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)

## Current Constraints

Amaryllis is not currently intended to provide:

- server-scale training or fleet orchestration;
- a universal model distribution service;
- unrestricted runtime source generation;
- automatic full-policy enforcement for every runtime personalization call;
- automatic semantic safety from schema validation alone;
- automatic security merely because inference is local;
- stable compatibility across every React Native, operating-system, device, and model combination.

Applications remain responsible for model licensing, distribution, integrity, storage, updates, device performance budgets, privacy policy, sensitive capability authorization, fallback behavior, and operational monitoring.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and contribution guidance.

## License

Amaryllis is [MIT licensed](LICENSE).