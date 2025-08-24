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

const setupAsyncCallbacks = (callbacks: LlmCallbacks) => {
  const subscriptions: EmitterSubscription[] = [];

  if (callbacks.onPartialResult) {
    subscriptions.push(
      llmEmitter.addListener(
        LlmNative.EVENT_ON_PARTIAL_RESULT,
        (result: string) => {
          callbacks.onPartialResult?.(result);
        }
      )
    );
  }

  if (callbacks.onFinalResult) {
    subscriptions.push(
      llmEmitter.addListener(
        LlmNative.EVENT_ON_FINAL_RESULT,
        (result: string) => {
          callbacks.onFinalResult?.(result);
          subscriptions.forEach((sub) => sub.remove());
        }
      )
    );
  }
  if (callbacks.onError) {
    subscriptions.push(
      llmEmitter.addListener(LlmNative.EVENT_ON_ERROR, (error: string) => {
        callbacks.onError?.(new Error(error));
        subscriptions.forEach((sub) => sub.remove());
      })
    );
  }
};

export class LlmPipe implements LlmEngine {
  async init(config: LlmEngineConfig): Promise<void> {
    await LlmNative.init({
      modelPath: config.modelPath,
      maxTopK: config.maxTopK ?? 64,
      maxTokens: config.maxTokens ?? 512,
      visionEncoderPath: config.visionEncoderPath,
      visionAdapterPath: config.visionAdapterPath,
      maxNumImages: config.maxNumImages ?? 1,
    });
  }

  async generate(params: LlmRequestParams): Promise<string> {
    return await LlmNative.generateSync({
      prompt: params.prompt,
      newSession: params.newSession,
      images: params.images?.map((img: LlmImageInput) => img.uri) ?? [],
    });
  }

  generateAsync(params: LlmRequestParams, callbacks?: LlmCallbacks): void {
    // Register streaming callbacks
    if (callbacks) {
      setupAsyncCallbacks(callbacks);
    }

    LlmNative.generateAsync({
      prompt: params.prompt,
      newSession: params.newSession,
      images: params.images?.map((img) => img.uri) ?? [],
    });
  }

  close(): void {
    LlmNative.close();
  }

  cancelAsync(): void {
    LlmNative.cancelAsync();
  }
}
