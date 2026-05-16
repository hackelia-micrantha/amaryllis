import { useCallback, useEffect } from 'react';
import { TouchableHighlight, StyleSheet, Text, View } from 'react-native';
import { useLLMContext } from '@micrantha/react-native-amaryllis';
import { usePromptContext } from '../PromptContext';
import { useModelContext } from '../ModelContext';

export const Header = () => {
  const { controller, isReady } = useLLMContext();
  const {
    setResults,
    setIsBusy,
    setError,
    setPrompt,
    setImages,
    setIsSessionReady,
  } = usePromptContext();

  const { setPaths: setModelPaths } = useModelContext();

  const importModels = useCallback(() => {
    setModelPaths(null);
  }, [setModelPaths]);

  const newSession = useCallback(async () => {
    if (isReady) {
      try {
        setIsSessionReady(false);
        await controller?.newSession({});
        setResults([]);
        setIsBusy(false);
        setError(undefined);
        setPrompt('');
        setImages([]);
        setIsSessionReady(true);
      } catch (error) {
        setError(
          error instanceof Error
            ? error
            : new Error('Failed to start model session')
        );
      }
    }
  }, [
    controller,
    isReady,
    setResults,
    setIsBusy,
    setError,
    setPrompt,
    setImages,
    setIsSessionReady,
  ]);

  useEffect(() => {
    if (isReady) {
      newSession();
    }
  }, [newSession, isReady]);

  return (
    <View style={styles.header}>
      <Text style={styles.title}>Amaryllis Chat</Text>
      <TouchableHighlight
        onPress={() => {
          newSession();
        }}
        style={styles.iconButton}
      >
        <Text style={styles.icon}>➕</Text>
      </TouchableHighlight>
      <TouchableHighlight onPress={importModels} style={styles.iconButton}>
        <Text style={styles.icon}>📥</Text>
      </TouchableHighlight>
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
