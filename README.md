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
```

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

You can access the LLM controller with a hook. See **Core API**.

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
import { useInference } from 'react-native-amaryllis';
import { useCallback, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';

const LLMPrompt = () => {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState([]);
  const [images, setImages] = useState([]);
  const [error, setError] = useState(undefined);
  const [isBusy, setIsBusy] = useState(false);

  const { result, generate, error, isLoading } = useInference({
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
  });

  const infer = useCallback(() => {
    generate({ prompt, images });
  }, [prompt, generate]);

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
    onPartialResult: (partial) => {
      console.log('Partial result:', partial);
    },
    onFinalResult: (final) => {
      console.log('Final result:', final);
    },
    onError: (err) => {
      console.error('Error:', err);
    },
  }
);
```

You can cancel an async generate if needed.

```javascript
amaryllis.cancelAsync();
```

---

## 📚 Documentation

- [API Reference](src/Types.ts)
- [Example App](example/)
- [Demo Video](docs/demo.mp4)
- [Development workflow](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is [MIT licensed](LICENSE).
