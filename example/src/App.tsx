import { LLMProvider } from 'react-native-amaryllis';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Chat } from './components';
import { PromptProvider } from './PromptContext';
import DL from '@kesha-antonov/react-native-background-downloader';

export default function App() {
  return (
    <LLMProvider
      config={{
        modelPath: `${DL.directories.documents}/amaryllis.model`,
        visionEncoderPath: `${DL.directories.documents}/amaryllis.vision`,
        maxNumImages: 2,
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
