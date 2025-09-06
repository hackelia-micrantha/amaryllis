import { LLMProvider } from 'react-native-amaryllis';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Chat } from './components';
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
        <SafeAreaProvider>
          <Chat />
        </SafeAreaProvider>
      </PromptProvider>
    </LLMProvider>
  );
}
