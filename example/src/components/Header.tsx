import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLLMContext } from 'react-native-amaryllis';
import { usePromptContext } from '../PromptContext';

export const Header = () => {
  const { controller, isReady } = useLLMContext();
  const { setResults, setIsBusy, setError, setPrompt, setImages } =
    usePromptContext();

  const newSession = useCallback(() => {
    if (isReady) {
      controller?.newSession({
        enableVisionModality: true,
      });
      setResults([]);
      setIsBusy(false);
      setError(undefined);
      setPrompt('');
      setImages([]);
    }
  }, [
    controller,
    isReady,
    setResults,
    setIsBusy,
    setError,
    setPrompt,
    setImages,
  ]);

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
