import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLLMContext } from 'react-native-amaryllis';
import { usePromptState } from './State';

export const LLMHeader = () => {
  const { controller, isReady } = useLLMContext();
  const state = usePromptState();
  const { setResults, setIsBusy, setError } = state;

  const newSession = useCallback(() => {
    if (isReady) {
      controller?.newSession({
        enableVisionModality: true,
      });
      setResults([]);
      setIsBusy(false);
      setError(undefined);
    }
  }, [controller, isReady, setResults, setIsBusy, setError]);

  useEffect(() => {
    newSession();
  }, [newSession]);

  return (
    <View style={styles.header}>
      <Text style={styles.title}>Amaryllis Chat</Text>
      <Pressable onPress={newSession} style={styles.iconButton}>
        <Text style={styles.icon}>➕</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 8,
    borderRadius: 6,
  },
  icon: {
    fontSize: 20,
    color: '#fff',
  },
});
