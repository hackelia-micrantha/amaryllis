import { NativeModules, NativeEventEmitter } from 'react-native';
import type {
  LlmEngine,
  LlmEngineConfig,
  LlmImageInput,
  LlmCallbacks,
  LlmRequestParams,
} from './Types';

const { Amaryllis: LlmNative } = NativeModules;
const llmEmitter = new NativeEventEmitter(LlmNative);

export class LlmPipe implements LlmEngine {
  async init(config: LlmEngineConfig): Promise<void> {
    await LlmNative.init({
      modelPath: config.modelPath,
      maxTopK: config.maxTopK ?? 64,
      enableVision: config.enableVision ?? false,
      maxNumImages: config.maxNumImages ?? 1,
    });
  }

  async generateSync(params: LlmRequestParams): Promise<string> {
    return await LlmNative.generateSync({
      prompt: params.prompt,
      maxTokens: params.maxTokens ?? 512,
      topK: params.topK ?? 40,
      temperature: params.temperature ?? 0.8,
      randomSeed: params.randomSeed ?? 0,
      images: params.images?.map((img: LlmImageInput) => img.uri) ?? [],
      loraPath: params.loraPath,
    });
  }

  generateAsync(params: LlmRequestParams, callbacks?: LlmCallbacks): void {
    // Register streaming callbacks
    if (callbacks) {
      if (callbacks.onPartialResult) {
        llmEmitter.addListener('onPartialResult', callbacks.onPartialResult);
      }
      if (callbacks.onFinalResult) {
        llmEmitter.addListener('onFinalResult', callbacks.onFinalResult);
      }
      if (callbacks.onError) {
        llmEmitter.addListener('onError', callbacks.onError);
      }
    }

    LlmNative.generateAsync({
      prompt: params.prompt,
      maxTokens: params.maxTokens ?? 512,
      topK: params.topK ?? 40,
      temperature: params.temperature ?? 0.8,
      randomSeed: params.randomSeed ?? 0,
      images: params.images?.map((img) => img.uri) ?? [],
      loraPath: params.loraPath,
    });
  }

  close(): void {
    LlmNative.close();
  }

  cancelAsync(): void {
    LlmNative.cancelAsync();
  }
}
