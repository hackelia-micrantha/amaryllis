import { useCallback, useMemo, useRef } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { InferenceProps } from '@micrantha/react-native-amaryllis';
import {
  useContextEngine,
  useContextInferenceAsync,
} from '@micrantha/react-native-amaryllis/context';
import { useLLMContext } from '@micrantha/react-native-amaryllis';
import {
  launchImageLibrary,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { usePromptContext } from '../PromptContext';

export const ChatPrompt = () => {
  const inputTextRef = useRef<TextInput>(null);
  const cancelInferenceRef = useRef<(() => void) | null>(null);
  const inferenceRequestIdRef = useRef(0);

  const {
    prompt,
    setPrompt,
    messages,
    setMessages,
    images,
    setImages,
    isBusy,
    setIsBusy,
    isSessionReady,
    error,
    setError,
  } = usePromptContext();

  const contextEngine = useContextEngine();
  const { controller } = useLLMContext();

  const clearActiveInference = useCallback(() => {
    inferenceRequestIdRef.current += 1;
    cancelInferenceRef.current = null;
  }, []);

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
        const userMsg = prompt;
        setPrompt('');
        setError(undefined);
        setIsBusy(true);

        setMessages((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: userMsg },
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: '',
            isGenerating: true,
          },
        ]);

        addContextItem(userMsg, 'user');
      },
      onResult: (result: string, isFinal: boolean) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            last.content = result;
            last.isGenerating = !isFinal;
          }
          return next;
        });

        if (isFinal) {
          clearActiveInference();
          addContextItem(result, 'assistant');
          setIsBusy(false);
        }
      },
      onError: (err) => {
        clearActiveInference();
        setError(err);
        setIsBusy(false);
      },
      onComplete: () => {
        clearActiveInference();
        setIsBusy(false);
      },
    }),
    [
      addContextItem,
      clearActiveInference,
      prompt,
      setError,
      setIsBusy,
      setMessages,
      setPrompt,
    ]
  );

  const generate = useContextInferenceAsync(props);
  const hasPrompt = prompt.trim().length > 0;

  const onInference = useCallback(async () => {
    if (!hasPrompt) {
      return;
    }

    const requestId = inferenceRequestIdRef.current + 1;
    inferenceRequestIdRef.current = requestId;
    const cancel = await generate({ prompt, images });
    if (inferenceRequestIdRef.current === requestId) {
      cancelInferenceRef.current = cancel;
    }
  }, [generate, hasPrompt, images, prompt]);

  const onCancelInference = useCallback(() => {
    const cancel = cancelInferenceRef.current;
    clearActiveInference();
    if (cancel) {
      cancel();
    } else {
      controller?.cancelAsync();
    }
    setIsBusy(false);
  }, [clearActiveInference, controller, setIsBusy]);

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
        {messages.map((m) => (
          <View
            key={m.id}
            style={[
              styles.message,
              m.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text style={styles.messageRole}>
              {m.role === 'user' ? 'You' : 'Amaryllis'}
            </Text>
            <Text style={styles.messageText}>{m.content}</Text>
            {m.isGenerating && (
              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={styles.inlineLoading}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {error && <Text style={styles.errorText}>{error.message}</Text>}

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputTextRef}
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Enter prompt..."
        />

        <Pressable
          disabled={!isBusy && (!isSessionReady || !hasPrompt)}
          style={styles.iconButton}
          onPress={isBusy ? onCancelInference : onInference}
        >
          <Text style={styles.icon}>{isBusy ? '■' : '➤'}</Text>
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

  message: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  messageRole: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
    color: '#rgba(0,0,0,0.5)',
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  inlineLoading: {
    marginTop: 4,
    alignSelf: 'flex-start',
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
    gap: 8,
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
