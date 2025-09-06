import { LLMProvider } from 'react-native-amaryllis';
import { LLMChatPrompt } from './ChatPrompt';
import { StyleSheet, View } from 'react-native';
import { LLMHeader } from './Header';
import { PromptProvider } from './PromptContext';

export default function App() {
  return (
    <LLMProvider
      config={{
        modelPath: 'gemma3-1b-it-int4.task',
        maxTopK: 32,
        maxNumImages: 2,
        maxTokens: 512,
        visionEncoderPath: 'mobilenet_v3_small.tflite',
        visionAdapterPath: 'mobilenet_v3_small.tflite',
      }}
    >
      <PromptProvider>
        <View style={styles.container}>
          <LLMHeader />
          <LLMChatPrompt />
        </View>
      </PromptProvider>
    </LLMProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
  },
});
