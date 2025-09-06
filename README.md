# react-native-amaryllis

![amaryllis](docs/amaryllis-128.png)

[![npm version](https://img.shields.io/npm/v/react-native-amaryllis.svg)](https://www.npmjs.com/package/react-native-amaryllis)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

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

### Basic Setup

```js
import { Amaryllis } from 'react-native-amaryllis';

await Amaryllis.init({
  modelPath: '/path/to/model.on/device', // gen model
  visionEncoderPath: '/path/to/visual.model', // vision encoder
  visionAdapterPath: '/path/to/visual.adapter', // vision model
  maxTopK: 10, // limit to top results
  maxTokens: 1024, // limit tokens
  maxNumImages: 5, // limit images
);
```

### Start a new session (new chat)

```js
  newSession: { // set to start a new session
    enableVisionModality: true, // use vision models
    randomSeed: 123432,
    loraPath: '/path/to/model/weights',
    topK: 40,
    topP: 0.75,
    temperature: 0.999
  }
});
```

### Generate Response

```js
const result = await Amaryllis.generate({
  prompt: 'Your prompt here',
  images: ['file:///path/to/image'],
});
```

### Streaming Response

```js
Amaryllis.generateAsync({
  prompt: 'Your prompt here',
  images: ['file:///path/to/image'],
  callbacks: {
    onPartialResult: (partial) => { /* handle partial */ },
    onFinalResult: (final) => { /* handle final */ },
    onError: (err) => { /* handle error */ },
  },
});
```

### Cleanup

```js
Amaryllis.close();
Amaryllis.cancelAsync();
```

---

## ⚛️ React Hooks

### Provider Setup

```tsx
import { LLMProvider } from 'react-native-amaryllis';

<LLMProvider config={{
  modelPath: '/data/tmp/models/gemma3',
  // .. other init args
}}>
  {/* children */}
</LLMProvider>
```

### Inference Hook

```tsx
import { useInference } from 'react-native-amaryllis';

const LLMPrompt = () => {
  const [prompt, setPrompt] = useState('');
  const { results, generate, error, isLoading } = useInference();

  const infer = useCallback(() => generate({ prompt }), [prompt, generate]);

  return (
    <View>
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Enter prompt..." />
      <Button title="Prompt" onPress={infer} />
      <Text>
        {error ? error.message : isLoading ? 'Loading...' : results.join('\n')}
      </Text>
    </View>
  );
};
```

---

## 📚 Documentation

- [API Reference](src/Types.ts)
- [Example App](example/)
- [Development workflow](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is [MIT licensed](LICENSE).
