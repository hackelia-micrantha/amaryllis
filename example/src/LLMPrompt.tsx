import { useState, useCallback } from 'react';
import { Text, View, TextInput, Button, StyleSheet } from 'react-native';
import { useInference } from 'react-native-amaryllis';

export const LLMPrompt = () => {
  const [prompt, setPrompt] = useState<string>('');
  const { results, generate, error, isLoading } = useInference();

  const infer = useCallback(
    async () => await generate({ prompt }),
    [prompt, generate]
  );

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
