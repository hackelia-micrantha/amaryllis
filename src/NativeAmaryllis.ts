import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  init(config: {
    modelPath: string; // Required: .task model path on device
    maxTopK?: number; // default: 64 (for session initialization)
    maxNumImages?: number; // default: 1
    maxTokens?: number; // default: 512
    visionEncoderPath?: string; // Optional: vision encoder model path for multimodal
    visionAdapterPath?: string; // Optional: vision adapter model path for multimodal
  }): Promise<void>;

  generate(params: {
    // Required
    prompt: string;
    newSession?: {
      // Optional generation settings
      topK?: number; // default: 40
      topP?: number; // default: 0.95
      temperature?: number; // default: 0.8
      randomSeed?: number; // default: 0
      loraPath?: string; // LoRA customization (GPU only)
      enableVisionModality?: boolean;
    };

    // Multimodal support
    images?: {
      uri: string; // Local file path or asset path
      width?: number; // Optional: image width
      height?: number; // Optional: image height
    }[];
  }): Promise<string>;

  generateAsync(params: {
    // Required
    prompt: string;
    newSession?: {
      // Optional generation settings
      topK?: number; // default: 40
      topP?: number; // default: 0.95
      temperature?: number; // default: 0.8
      randomSeed?: number; // default: 0
      loraPath?: string; // LoRA customization (GPU only)
      enableVisionModality?: boolean;
    };

    // Multimodal support
    images?: {
      uri: string; // Local file path or asset path
      width?: number; // Optional: image width
      height?: number; // Optional: image height
    }[];
  }): Promise<void>;

  close(): void;

  cancelAsync(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Amaryllis');
