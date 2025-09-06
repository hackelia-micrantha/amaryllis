import { useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { createLLMObservable, useLLMContext } from 'react-native-amaryllis';
import {
  launchImageLibrary,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { usePromptState } from './State';

export const LLMChatPrompt = () => {
  const {
    prompt,
    setPrompt,
    images,
    setImages,
    results,
    setResults,
    isBusy,
    setIsBusy,
    error,
    setError,
  } = usePromptState();
  const { controller } = useLLMContext();
  const inputTextRef = useRef<TextInput>(null);

  const llm$ = useMemo(() => createLLMObservable(), []);

  const infer = useCallback(async () => {
    setError(undefined);
    setResults([]);
    setIsBusy(true);
    inputTextRef.current?.setSelection(0, prompt.length);
    console.log(images);
    await controller?.generateAsync({ prompt, images }, llm$.callbacks);
  }, [
    setError,
    setResults,
    setIsBusy,
    prompt,
    images,
    controller,
    llm$.callbacks,
  ]);

  useEffect(() => {
    const sub = llm$.observable.subscribe({
      next: ({ text, isFinal }) => {
        setResults((prev) => [...prev, text]);
        if (isFinal) {
          setIsBusy(false);
        }
      },
      complete: () => {},
      error: (err) => setError(err),
    });

    return () => {
      sub.unsubscribe();
      controller?.cancelAsync();
    };
  }, [llm$.observable, controller, setResults, setIsBusy, setError]);

  const selectImage = useCallback(() => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 1,
    };
    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        return;
      }

      const asset = response.assets?.[0]?.uri;
      if (asset) {
        setImages((prev) => [...prev, asset].slice(-2)); // Keep only the last 2 images
      }
    });
  }, [setImages]);

  const clearImages = useCallback(() => {
    setImages([]);
  }, [setImages]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.contentText}>{results}</Text>
      </ScrollView>

      <Text style={styles.errorText}>{error?.message}</Text>

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputTextRef}
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Enter prompt..."
        />

        <Pressable disabled={isBusy} style={styles.iconButton} onPress={infer}>
          <Text style={styles.icon}>{isBusy ? '⏳' : '➤'}</Text>
        </Pressable>

        <Pressable
          disabled={isBusy}
          style={styles.iconButton}
          onPress={selectImage}
        >
          <Text style={styles.icon}>📷</Text>
        </Pressable>
      </View>
      <View style={styles.imageContainer}>
        {images.length > 0 && (
          <Text style={styles.imageText}>
            {images.length === 1
              ? '1 image selected'
              : `${images.length} images selected`}
          </Text>
        )}
        {images.length > 0 && (
          <Pressable style={styles.clearButton} onPress={clearImages}>
            <Text style={styles.icon}>❌</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
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

  iconButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  icon: {
    fontSize: 20,
    color: '#fff',
  },

  clearButton: {
    padding: 8,
    marginTop: 8,
  },

  imageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  imageText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
  errorText: {
    color: 'red',
    padding: 8,
    marginTop: 8,
  },
});
