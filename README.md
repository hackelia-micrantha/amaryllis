# react-native-amaryllis

![amaryllis](docs/amaryllis-128.png)

[![npm version](https://img.shields.io/npm/v/react-native-amaryllis.svg)](https://www.npmjs.com/package/react-native-amaryllis) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Amaryllis Hippeastrum**: Symbolizes hope and emergence, blooming even in tough conditions.

A modern AI module for native mobile apps in React Native, supporting multimodal inference and streaming results.

---

## 🚀 Installation

```sh
npm install react-native-amaryllis
# or
yarn add react-native-amaryllis
# or
pnpm add react-native-amaryllis
```

---

## ✅ Requirements

- React Native and React (peer dependencies)
- Node.js v24.0.0 for development (see `.nvmrc`)

---

## 📱 Compatibility

| Area | Status |
| --- | --- |
| React Native | Tested with 0.83.x in this repo |
| Android | Example app built in CI on ubuntu-latest |
| iOS | Example app built in CI with Xcode 16.4 |

---

## 📦 Features

- Native LLM engine for Android & iOS
- Multimodal support (text + images)
- Streaming inference with hooks & observables
- Easy integration with React Native context/provider
- LoRA customization (GPU only)

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
  config, // original config param
  controller, // native controller
  error, // any error
  isReady, // is controller initialized
} = useLLMContext();
```

### Inference Hook

Use the `useInference` hook to access the LLM's capabilities.

```tsx
import { useInferenceAsync } from 'react-native-amaryllis';
import { useCallback, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';

const LLMPrompt = () => {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState([]);
  const [images, setImages] = useState([]);
  const [error, setError] = useState(undefined);
  const [isBusy, setIsBusy] = useState(false);

  const props = useMemo(() => ({
    onGenerate: () => {
      setError(undefined);
      setIsBusy(true);
    },
    onResult: (result, isFinal) => {
      setResults((prev) => [...prev, result]);
      if (isFinal) {
        setIsBusy(false);
      }
    },
    onError: (err) => setError(err)
  }), [setError, setIsBusy, setResults])

  const generate = useInferenceAsync(props);

  const infer = useCallback(async () => {
    await generate({ prompt, images });
  }, [prompt, generate, images]);

  return (
    <View>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Enter prompt..."
      />
      <Button title="Generate" onPress={infer} />
      <Text>
        {error ? error.message : results.join('\n')}
      </Text>
      {/* image controls */}
    </View>
  );
};
```

Substitute the `useInferenceAsync` hook to stream the results.

---

## ✅ Best Practices

- Stream results for responsive UIs and show partial tokens.
- Cancel async generation on unmount to avoid leaks.
- Limit image sizes and count for consistent memory usage.
- Validate file paths before passing them to native APIs.
- Handle errors with custom error types and fallbacks.

---

## 🛠️ Troubleshooting

- Build errors: run `yarn clean`, then `yarn prepare`.
- iOS: `cd example && bundle exec pod install` after dependency changes.
- Android: ensure `example/android/local.properties` has `sdk.dir` set.

---

## ❓ FAQ

**Does Amaryllis require a network connection?**
No. Inference runs on-device; any network usage is up to your app.

**Where should model files live?**
Download and store them on the device, then pass the file paths in config.

**Can I stream responses?**
Yes. Use `useInferenceAsync` or the `generateAsync` API.

---

### Core API

For more advanced use cases, you can use the core `Amaryllis` API directly.
This is the same controller passed from `useLLMContext`.

#### Initialization

```javascript
import { Amaryllis } from 'react-native-amaryllis';

const amaryllis = new Amaryllis();

await amaryllis.init({
  modelPath: '/path/to/your/model.task',
  visionEncoderPath: '/path/to/vision/encoder.tflite',
  visionAdapterPath: '/path/to/vision/adapter.tflite',
});
```

A session is required for working with images.

```javascript
await amaryllis.newSession({
  topK: 40, // only top results
  topP: 0.95, // only top percentage match
  temperature: 0.8,
  randomSeed: 0, // for reproducing
  loraPath: "", // LoRA customization (GPU only)
  enableVisionModality: true // for vision
})
```

#### Generate Response

```javascript
const result = await amaryllis.generate({
  prompt: 'Your prompt here',
  images: ['file:///path/to/image.png'],
});
```

#### Streaming Response

```javascript
amaryllis.generateAsync(
  {
    prompt: 'Your prompt here',
    images: ['file:///path/to/image.png'],
  },
  {
    onEvent: (event) => {
      if (event.type === 'partial') {
        console.log('Partial result:', event.text);
        return;
      }
      if (event.type === 'final') {
        console.log('Final result:', event.text);
        return;
      }
      console.error('Error:', event.error);
    },
  }
);
```

Note: `onPartialResult`, `onFinalResult`, and `onError` are deprecated and will be removed in a future release. Use `onEvent` instead.

`onEvent` receives a discriminated union:

```ts
type LlmEvent =
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'error'; error: Error };
```

You can cancel an async generate if needed.

```javascript
amaryllis.cancelAsync();
```

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
- [Context Engine](docs/context-engine.md)
- [Example App](example/)
- [Demo Video](docs/demo.mp4)
- [Development workflow](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)

---

## 🔒 Security & Privacy

Amaryllis runs inference on-device. You control model files, prompts, and
image inputs. Ensure your app follows your organization’s data handling and
privacy requirements.

---

## 🚢 Release Process

- Update `CHANGELOG.md` and version using `yarn release`.
- Tag releases as `vX.Y.Z` (see `RELEASE.md`).
- Publishing is automated by GitHub Actions on tag push.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is [MIT licensed](LICENSE).
