# react-native-amaryllis

![amaryllis](docs/amaryllis-128.png)

A AI module for native mobile in react.

> *Amaryllis Hippeastrum*: Amaryllis flowers often bloom during the colder months, which gives them a connotation of hope and emergence, representing new life or energy even in tough conditions.

## Installation


```sh
npm install react-native-amaryllis
```


## Usage

Setup a provider in your root app:

```js
import { LLMProvider, useInference } from 'react-native-amaryllis';

// ...
  <LLMProvider config={{
     modelPath="/data/tmp/models/gemma3"
     enableVision=true
  >

  </LLMProvider>
```

Setup an inference call in a component:

```js
const LLMPrompt = () => {
  const [prompt, setPrompt] = useState<string>('');
  const { results, generate, error, isLoading } = useInference();

  const infer = useCallback(() => generate({ prompt }), [prompt, generate]);

  return (
    <View style={styles.container}>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Enter prompt..."
      />
      <Button title="Prompt" onPress={infer} />
      <Text>
        Result: {error ? error.message : isLoading ? 'Loading...' : results}
      </Text>
    </View>
  );
};
```

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
