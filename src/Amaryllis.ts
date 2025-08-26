import {
  NativeModules,
  NativeEventEmitter,
  type EmitterSubscription,
} from 'react-native';
import type {
  LlmEngine,
  LlmEngineConfig,
  LlmSessionParams,
  LlmCallbacks,
  LlmRequestParams,
} from './Types';

const { Amaryllis: LlmNative } = NativeModules;
const llmEmitter = new NativeEventEmitter(LlmNative);

export class LlmPipe implements LlmEngine {
  subscriptions: EmitterSubscription[] = [];

  async init(params: LlmEngineConfig): Promise<void> {
    await LlmNative.init(params);
  }

  newSession(params: LlmSessionParams): Promise<void> {
    return LlmNative.newSession(params);
  }

  async generate(params: LlmRequestParams): Promise<string> {
    return await LlmNative.generateSync(params);
  }

  async generateAsync(
    params: LlmRequestParams,
    callbacks?: LlmCallbacks
  ): Promise<void> {
    // Register streaming callbacks
    if (callbacks) {
      this.setupAsyncCallbacks(callbacks);
    }

    return await LlmNative.generateAsync(params);
  }

  close(): void {
    LlmNative.close();
    this.cancelAsync();
  }

  cancelAsync(): void {
    LlmNative.cancelAsync();
    this.subscriptions.forEach((sub) => sub.remove());
  }

  setupAsyncCallbacks(callbacks: LlmCallbacks): void {
    if (callbacks.onPartialResult) {
      this.subscriptions.push(
        llmEmitter.addListener(
          LlmNative.EVENT_ON_PARTIAL_RESULT,
          (result: string) => {
            callbacks.onPartialResult?.(result);
          }
        )
      );
    }

    if (callbacks.onFinalResult) {
      this.subscriptions.push(
        llmEmitter.addListener(
          LlmNative.EVENT_ON_FINAL_RESULT,
          (result: string) => {
            callbacks.onFinalResult?.(result);
            this.cancelAsync();
          }
        )
      );
    }
    if (callbacks.onError) {
      this.subscriptions.push(
        llmEmitter.addListener(LlmNative.EVENT_ON_ERROR, (error: string) => {
          callbacks.onError?.(new Error(error));
          this.cancelAsync();
        })
      );
    }
  }
}

export default new LlmPipe();
