import { LLMProvider } from 'react-native-amaryllis';
import { LLMPrompt } from './LLMPrompt';

export default function App() {
  return (
    <LLMProvider
      config={{
        modelPath: 'gemma3-1b-it-int4.task',
        maxTopK: 64,
        maxNumImages: 1,
        maxTokens: 512,
        // visionEncoderPath: 'vision_encoder.task',
        // visionAdapterPath: 'vision_adapter.task',
      }}
    >
      <LLMPrompt />
    </LLMProvider>
  );
}
