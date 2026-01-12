import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  init(params: {
    modelPath: string;
    maxTopK?: number;
    maxNumImages?: number;
    maxTokens?: number;
    visionEncoderPath?: string;
    visionAdapterPath?: string;
  }): Promise<void>;

  newSession(params?: {
    topK?: number;
    topP?: number;
    temperature?: number;
    randomSeed?: number;
    loraPath?: string;
    enableVisionModality?: boolean;
  }): Promise<void>;

  generate(params: { prompt: string; images?: string[] }): Promise<string>;

  generateAsync(params: { prompt: string; images?: string[] }): Promise<void>;

  close(): void;

  cancelAsync(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Amaryllis');
