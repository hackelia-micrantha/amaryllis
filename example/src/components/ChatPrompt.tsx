import { useCallback, useRef, useMemo } from 'react';
import {
  Text,
  View,
  KeyboardAvoidingView,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useInferenceAsync, type InferenceProps } from 'react-native-amaryllis';
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

  const props: InferenceProps = useMemo(
    () => ({
      onGenerate: () => {
        inputTextRef.current?.setSelection(0, prompt.length);
        setError(undefined);
        setIsBusy(true);
      },
      onResult: (result: string, isFinal: any) => {
        setResults((prev) => [...prev, result]);
        if (isFinal) {
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
    [prompt.length, setError, setIsBusy, setResults]
  );

  const generate = useInferenceAsync(props);

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

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
      </KeyboardAvoidingView>
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
