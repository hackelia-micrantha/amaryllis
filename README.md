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
- schemas, registries, policy, and deterministic validation remain authoritative;
- runtime personalization uses bounded structured data rather than executable JSX or TSX.

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
   - schema and policy validation;
   - generation, registry, and packaging primitives;
   - bounded runtime personalization.

```text
Application UI and product logic
  -> contracts, policy, and validation
  -> Amaryllis provider / hooks / controller
  -> native Android and iOS inference
  -> application-selected model assets

ComponentSpec
  -> schema and policy validation
  -> registry-approved implementation
  -> validated props, variants, slots, or patches
  -> render
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
  onResult: (chunk, isFinal) => {
    append(chunk);
    if (isFinal) finish();
  },
  onError: handleError,
});

await generate({ prompt, images });
```

Applications should cancel active work during lifecycle cleanup and bound image count, image size, and token budgets for predictable resource use.

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
- **Personalize:** return validated props, variants, slot text, or constrained JSON patches at runtime.

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

Runtime AI does not directly register implementations, mutate authoritative specs, bypass policy, or introduce executable imports.

## Security Model

The central security principle is:

```text
AI output is not authoritative.
```

Amaryllis keeps authority in deterministic application-controlled systems:

- component specs and runtime contracts;
- registries and implementation identities;
- schema and policy validation;
- lifecycle and rendering code;
- build review and release controls.

Local inference reduces some network exposure, but it does not eliminate client compromise, reverse engineering, malicious model assets, resource exhaustion, or privacy leakage through application logging and fallback behavior.

See [Security Model](docs/security-model.md) and [Threat Model](docs/threat-model.md).

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
- automatic security merely because inference is local;
- stable compatibility across every React Native, operating-system, device, and model combination.

Applications remain responsible for model licensing, distribution, integrity, storage, updates, device performance budgets, privacy policy, fallback behavior, and operational monitoring.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and contribution guidance.

## License

Amaryllis is [MIT licensed](LICENSE).
