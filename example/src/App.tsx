import { LLMProvider } from 'react-native-amaryllis';
import { LLMPrompt } from './LLMPrompt';

export default function App() {
  return (
    <LLMProvider
      config={{
        modelPath: '/data/local/tmp/llm/model_version.task',
        maxTopK: 64,
        maxNumImages: 1,
        maxTokens: 512,
        visionEncoderPath: '/data/local/tmp/llm/vision_encoder.model',
        visionAdapterPath: '/data/local/tmp/llm/vision_adapter.model',
      }}
    >
      <LLMPrompt />
    </LLMProvider>
  );
}
