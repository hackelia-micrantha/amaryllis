import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  init(config: {
    modelPath: string; // Required: .task model path on device
    maxTopK?: number; // default: 64 (for session initialization)
    enableVision?: boolean; // default: false
    maxNumImages?: number; // default: 1
  }): Promise<void>;

  generate(params: {
    // Required
    prompt: string;

    // Optional generation settings
    maxTokens?: number; // default: 512
    topK?: number; // default: 40
    temperature?: number; // default: 0.8
    randomSeed?: number; // default: 0

    // Multimodal support
    images?: {
      uri: string; // Local file path or asset path
      width?: number; // Optional: image width
      height?: number; // Optional: image height
    }[];

    // LoRA customization (GPU only)
    loraPath?: string;
  }): Promise<string>;

  generateAsync(params: {
    // Required
    prompt: string;

    // Optional generation settings
    maxTokens?: number; // default: 512
    topK?: number; // default: 40
    temperature?: number; // default: 0.8
    randomSeed?: number; // default: 0

    // Multimodal support
    images?: {
      uri: string; // Local file path or asset path
      width?: number; // Optional: image width
      height?: number; // Optional: image height
    }[];

    // LoRA customization (GPU only)
    loraPath?: string;
  }): Promise<void>;

  close(): void;

  cancelAsync(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Amaryllis');
