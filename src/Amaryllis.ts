import type {
  LlmEngine,
  LlmEngineConfig,
  LlmSessionParams,
  LlmCallbacks,
  LlmRequestParams,
  LlmEventEmitter,
  LlmEventSubscription,
  LlmPipeParams,
  LlmNativeEngine,
} from './Types';
import {
  toNativeEngineConfig,
  toNativeSessionParams,
  toNativeRequestParams,
} from './TypeConverters';

const EVENT_ON_PARTIAL_RESULT = 'onPartialResult';
const EVENT_ON_FINAL_RESULT = 'onFinalResult';
const EVENT_ON_ERROR = 'onError';

export class LlmPipe implements LlmEngine {
  subscriptions: LlmEventSubscription[] = [];
  llmEmitter: LlmEventEmitter;
  llmNative: LlmNativeEngine;

  constructor(params: LlmPipeParams) {
    this.llmNative = params.nativeModule;
    this.llmEmitter = params.eventEmitter;
  }

  async init(params: LlmEngineConfig): Promise<void> {
    const nativeConfig = toNativeEngineConfig(params);
    await this.llmNative.init(nativeConfig);
  }

  newSession(params: LlmSessionParams): Promise<void> {
    const nativeParams = toNativeSessionParams(params);
    return this.llmNative.newSession(nativeParams);
  }

  async generate(params: LlmRequestParams): Promise<string> {
    const nativeParams = toNativeRequestParams(params);
    return await this.llmNative.generate(nativeParams);
  }

  async generateAsync(
    params: LlmRequestParams,
    callbacks?: LlmCallbacks
  ): Promise<void> {
    if (callbacks) {
      this.setupAsyncCallbacks(callbacks);
    }

    const nativeParams = toNativeRequestParams(params);
    return await this.llmNative.generateAsync(nativeParams);
  }

  close(): void {
    this.cancelAsync();
    this.llmNative.close();
  }

  cancelAsync(): void {
    this.llmNative.cancelAsync();
    const subsToRemove = [...this.subscriptions];
    this.subscriptions = [];
    subsToRemove.forEach((sub) => {
      try {
        sub.remove();
      } catch (error) {
        console.warn('Failed to remove subscription:', error);
      }
    });
  }

  setupAsyncCallbacks(callbacks: LlmCallbacks): void {
    if (callbacks.onPartialResult) {
      const subscription = this.llmEmitter.addListener(
        EVENT_ON_PARTIAL_RESULT,
        (result: string) => {
          try {
            callbacks.onPartialResult?.(result);
          } catch (error) {
            console.error('Error in onPartialResult callback:', error);
          }
        }
      );
      this.subscriptions.push(subscription);
    }

    if (callbacks.onFinalResult) {
      const subscription = this.llmEmitter.addListener(
        EVENT_ON_FINAL_RESULT,
        (result: string) => {
          try {
            callbacks.onFinalResult?.(result);
          } catch (error) {
            console.error('Error in onFinalResult callback:', error);
          } finally {
            this.cancelAsync();
          }
        }
      );
      this.subscriptions.push(subscription);
    }

    if (callbacks.onError) {
      const subscription = this.llmEmitter.addListener(
        EVENT_ON_ERROR,
        (error: string) => {
          try {
            callbacks.onError?.(new Error(error));
          } catch (callbackError) {
            console.error('Error in onError callback:', callbackError);
          } finally {
            this.cancelAsync();
          }
        }
      );
      this.subscriptions.push(subscription);
    }
  }
}

export default LlmPipe;
