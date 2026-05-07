# react-native-amaryllis

![amaryllis](docs/amaryllis-128.png)

[![npm version](https://img.shields.io/npm/v/react-native-amaryllis.svg)](https://www.npmjs.com/package/react-native-amaryllis) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Amaryllis Hippeastrum**: Symbolizes hope and emergence, blooming even in tough conditions.

Amaryllis is a React Native runtime for on-device multimodal AI. It exposes local inference, streaming interaction, and offline-first context integration through a native mobile API surface.

On the `feature/ai-components` branch, that base runtime is extended with a companion workspace, `@micrantha/amaryllis-components`, for spec-driven, governed, AI-enabled React components.

---

## What lives in this branch

This branch contains two related layers:

1. **Base Amaryllis runtime**
   - on-device multimodal inference for React Native
   - local model execution on Android and iOS
   - streaming hooks, provider, and controller APIs
   - offline-first context and retrieval interfaces

2. **Amaryllis Components companion module**
   - a typed `ComponentSpec`
   - schema validation and policy enforcement
   - generation and registry primitives
   - bounded runtime personalization contracts
   - a draft RFC for governed AI-enabled components

At a high level:

```text
React Native components
  -> LLMProvider / hooks / controller
  -> TurboModule bridge
  -> native inference runtime
  -> on-device model assets

ComponentSpec / policy / registry
  -> @micrantha/amaryllis-components
  -> validated generation or personalization outputs
  -> governed component rendering
```

---

## Branch-aware documentation

- [Architecture](docs/architecture.md)
- [Local AI and MediaPipe](docs/local-ai.md)
- [Concepts](docs/concepts.md)
- [AI-enabled components](docs/ai-enabled-components.md)
- [Runtime personalization](docs/runtime-personalization.md)
- [Amaryllis Components RFC](docs/amaryllis_ai_component_module_rfc.md)
- [Context Engine](docs/context-engine.md)
- [Examples](docs/examples)

---

## 🚀 Installation

```sh
npm install react-native-amaryllis
# or
yarn add react-native-amaryllis
# or
pnpm add react-native-amaryllis
```

For the companion package in this branch:

```sh
yarn workspace @micrantha/amaryllis-components build
```

---

## ✅ Requirements

- React Native and React (peer dependencies)
- Node.js v24.0.0 for development (see `.nvmrc`)
- React 18+ for `@micrantha/amaryllis-components`

---

## 📱 Compatibility

| Area | Status |
| --- | --- |
| React Native | Tested with 0.83.x in this repo |
| Android | Example app built in CI on ubuntu-latest |
| iOS | Example app built in CI with Xcode 16.4 |
| Components workspace | Present on `feature/ai-components` |

---

## 📦 Features

### Base runtime

- Native on-device LLM engine for Android & iOS
- Multimodal support (text + images)
- Streaming inference with hooks & observables
- Easy integration with React Native context/provider
- Offline-first context retrieval and memory interfaces
- LoRA customization (GPU only)

### Companion module (`@micrantha/amaryllis-components`)

- Typed `ComponentSpec` model
- JSON schema and policy validation
- CLI and generator scaffolding
- Personalization runtime primitives
- Bounded outputs for variants, props, and JSON patch workflows

---

## 🛠️ Usage

### Provider Setup

Wrap your application with `LLMProvider` and provide the necessary model paths. The models should be downloaded to the device.

```tsx
import { LLMProvider } from 'react-native-amaryllis';

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
  {/* Your app components */}
</LLMProvider>
```

You can access the LLM controller with a `useLLMContext` hook. See **Core API** for details on the controller API.

```tsx
const {
  config,
  controller,
  error,
  isReady,
} = useLLMContext();
```

### Inference Hook

Use the `useInferenceAsync` hook to access the LLM runtime.

```tsx
import { useInferenceAsync } from 'react-native-amaryllis';
import { useCallback, useMemo, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';

const LLMPrompt = () => {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  const props = useMemo(
    () => ({
      onGenerate: () => {
        setError(undefined);
        setIsBusy(true);
      },
      onResult: (result: string, isFinal: boolean) => {
        setResults((prev) => [...prev, result]);
        if (isFinal) {
          setIsBusy(false);
        }
      },
      onError: (err: Error) => setError(err),
    }),
    []
  );

  const generate = useInferenceAsync(props);

  const infer = useCallback(async () => {
    await generate({ prompt, images });
  }, [prompt, generate, images]);

  return (
    <View>
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Enter prompt..." />
      <Button title="Generate" onPress={infer} disabled={isBusy} />
      <Text>{error ? error.message : results.join('\n')}</Text>
    </View>
  );
};
```

### Companion Module Example

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

---

## ✅ Best Practices

- Stream results for responsive UIs and show partial tokens
- Cancel async generation on unmount to avoid leaks
- Limit image sizes and count for consistent memory usage
- Validate file paths before passing them to native APIs
- Keep model assets and prompts within your app’s privacy boundary
- Treat runtime AI output as untrusted data until validated
- Keep the `ComponentSpec` and registry authoritative over personalization overlays

---

## ❓ FAQ

**Does Amaryllis require a network connection?**  
No. Inference runs on-device; any network usage is up to your app.

**Is this branch only about chat UIs?**  
No. The base runtime supports multimodal local inference, and the companion workspace explores governed AI-enabled components.

**Can on-device AI emit arbitrary JSX or TSX?**  
Not in the component model described by this branch. The RFC constrains device-time outputs to structured data such as props, variants, slot text, or limited JSON patch overlays.

---

## 🧠 Context Engine

The Context Engine is an interface-first layer for memory and retrieval. You bring your own `ContextStore` (SQLite, files, or custom DB) while the engine handles validation, policy bounds, and optional scoring.
Context APIs are also available via the `react-native-amaryllis/context` subpath.

```ts
import { ContextEngine } from 'react-native-amaryllis/context';

const engine = new ContextEngine({
  store: myStore,
  policy: { maxItems: 1000, defaultTtlSeconds: 60 * 60 * 24 },
});

await engine.add([{ id: 'mem-1', text: 'Quest started', createdAt: Date.now() }]);
const results = await engine.search({ text: 'quest', limit: 5 });
```

See `docs/context-engine.md` for details.

---

## 📚 Documentation

- [API Reference](src/Types.ts)
- [Architecture](docs/architecture.md)
- [Local AI and MediaPipe](docs/local-ai.md)
- [Concepts](docs/concepts.md)
- [AI-enabled components](docs/ai-enabled-components.md)
- [Runtime personalization](docs/runtime-personalization.md)
- [Amaryllis Components RFC](docs/amaryllis_ai_component_module_rfc.md)
- [Context Engine](docs/context-engine.md)
- [Examples](docs/examples)
- [Example App](example/)
- [Development workflow](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)

---

## 🔒 Security & Privacy

Amaryllis runs inference on-device. You control model files, prompts, and image inputs. Ensure your app follows your organization’s data handling and privacy requirements.

For the companion component model, runtime AI output should be treated as untrusted until it passes schema and policy validation.

---

## 🤝 Contributing

We welcome contributions. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is [MIT licensed](LICENSE).
