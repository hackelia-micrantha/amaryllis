import { useState, useCallback } from 'react';
import { Text, View, StyleSheet, TextInput, Button } from 'react-native';
import { useInference, LLMProvider } from 'react-native-amaryllis';

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

export default function App() {
  return (
    <LLMProvider
      config={{
        modelPath: '/data/local/tmp/llm/model_version.task',
        maxTopK: 64,
        maxNumImages: 1,
        maxTokens: 512,
        visionEncoderPath: '/data/local/tmp/llm/vision_encoder.model',
        visionAdapterPath: '/data/local/tmp/llm/vision_adapter.model',
      }}
      newSession={{
        enableVisionModality: true,
        randomSeed: 13933,
        loraPath: '/data/local/tmp/llm/lora.model',
        temperature: 0.795,
      }}
    >
      <LLMPrompt />
    </LLMProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
