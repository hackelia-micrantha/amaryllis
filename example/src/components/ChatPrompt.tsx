import { useCallback, useMemo, useRef } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { InferenceProps } from 'react-native-amaryllis';
import {
  useContextEngine,
  useContextInferenceAsync,
} from 'react-native-amaryllis/context';
import {
  launchImageLibrary,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { usePromptContext } from '../PromptContext';

export const ChatPrompt = () => {
  const inputTextRef = useRef<TextInput>(null);

  const {
    prompt,
    setPrompt,
    results,
    setResults,
    images,
    setImages,
    isBusy,
    setIsBusy,
    error,
    setError,
  } = usePromptContext();

  const contextEngine = useContextEngine();

  const addContextItem = useCallback(
    async (text: string, tag: string) => {
      if (!contextEngine) {
        return;
      }
      try {
        await contextEngine.add([
          {
            id: `${tag}-${Date.now()}`,
            text,
            tags: [tag],
            createdAt: Date.now(),
          },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to store context')
        );
      }
    },
    [contextEngine, setError]
  );

  const props: InferenceProps = useMemo(
    () => ({
      onGenerate: () => {
        inputTextRef.current?.setSelection(0, prompt.length);
        setError(undefined);
        setIsBusy(true);
        addContextItem(prompt, 'user');
      },
      onResult: (result: string, isFinal: boolean) => {
        setResults((prev) => [...prev, result]);
        if (isFinal) {
          addContextItem(result, 'assistant');
          setIsBusy(false);
        }
      },
      onError: (err) => {
        setError(err);
        setIsBusy(false);
      },
      onComplete: () => {
        setIsBusy(false);
      },
    }),
    [addContextItem, prompt, setError, setIsBusy, setResults]
  );

  const generate = useContextInferenceAsync(props);

  const onInference = useCallback(async () => {
    await generate({ prompt, images });
  }, [generate, images, prompt]);

  const onSelectImage = useCallback(() => {
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

  const onClearImages = useCallback(() => {
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

        <Pressable
          disabled={isBusy}
          style={styles.iconButton}
          onPress={onInference}
        >
          <Text style={styles.icon}>{isBusy ? '⏳' : '➤'}</Text>
        </Pressable>

        <Pressable
          disabled={isBusy}
          style={styles.iconButton}
          onPress={onSelectImage}
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
          <Pressable style={styles.clearButton} onPress={onClearImages}>
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

  keyboardContainer: {
    flex: 1,
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
    justifyContent: 'flex-end',
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
