import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Text,
  View,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { createLLMObservable, useLLMContext } from 'react-native-amaryllis';

export const LLMStreamingPrompt = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<Error | undefined>(undefined);
  const { controller } = useLLMContext();

  const llm$ = useMemo(() => createLLMObservable(), []);

  const infer = useCallback(async () => {
    setError(undefined);
    setResults([]);
    await controller?.generateAsync({ prompt }, llm$.callbacks);
  }, [prompt, controller, llm$.callbacks]);

  useEffect(() => {
    const sub = llm$.observable.subscribe({
      next: (result) => {
        setResults((prev) => [...prev, result]);
      },
      complete: () => {},
      error: (err) => setError(err),
    });

    return () => {
      sub.unsubscribe();
      controller?.cancelAsync();
    };
  }, [llm$.observable, controller]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.contentText}>{results}</Text>
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Enter prompt..."
        />
        <Button title="Prompt" onPress={infer} />
      </View>
      {error ? 'Error: ' : null}
      {error?.message}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
  },

  scrollView: {
    flex: 1,
    marginBottom: 12,
  },

  contentText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // RN 0.71+ supports gap
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
});
