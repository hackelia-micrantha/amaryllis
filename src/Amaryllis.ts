import {
  NativeModules,
  NativeEventEmitter,
  type EmitterSubscription,
} from 'react-native';
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

  async generate(params: LlmRequestParams): Promise<string> {
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
      let partialListener: EmitterSubscription | null = null;
      let finalListener: EmitterSubscription | null = null;
      let errorListener: EmitterSubscription | null = null;

      if (callbacks.onPartialResult) {
        partialListener = llmEmitter.addListener(
          'onPartialResult',
          (result: string) => {
            callbacks.onPartialResult?.(result);
          }
        );
      }

      if (callbacks.onFinalResult) {
        finalListener = llmEmitter.addListener(
          'onFinalResult',
          (result: string) => {
            callbacks.onFinalResult?.(result);
            finalListener?.remove();
            partialListener?.remove();
            errorListener?.remove();
          }
        );
      }
      if (callbacks.onError) {
        errorListener = llmEmitter.addListener('onError', (error: string) => {
          callbacks.onError?.(new Error(error));
          errorListener?.remove();
          finalListener?.remove();
          partialListener?.remove();
        });
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
