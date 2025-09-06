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
    await this.llmNative.init(params);
  }

  newSession(params: LlmSessionParams): Promise<void> {
    return this.llmNative.newSession(params);
  }

  async generate(params: LlmRequestParams): Promise<string> {
    return await this.llmNative.generate(params);
  }

  async generateAsync(
    params: LlmRequestParams,
    callbacks?: LlmCallbacks
  ): Promise<void> {
    if (callbacks) {
      this.setupAsyncCallbacks(callbacks);
    }

    return await this.llmNative.generateAsync(params);
  }

  close(): void {
    this.llmNative.close();
    this.cancelAsync();
  }

  cancelAsync(): void {
    this.llmNative.cancelAsync();
    this.subscriptions.forEach((sub) => sub.remove());
  }

  setupAsyncCallbacks(callbacks: LlmCallbacks): void {
    if (callbacks.onPartialResult) {
      this.subscriptions.push(
        this.llmEmitter.addListener(
          EVENT_ON_PARTIAL_RESULT,
          (result: string) => {
            callbacks.onPartialResult?.(result);
          }
        )
      );
    }

    if (callbacks.onFinalResult) {
      this.subscriptions.push(
        this.llmEmitter.addListener(EVENT_ON_FINAL_RESULT, (result: string) => {
          callbacks.onFinalResult?.(result);
          this.cancelAsync();
        })
      );
    }
    if (callbacks.onError) {
      this.subscriptions.push(
        this.llmEmitter.addListener(EVENT_ON_ERROR, (error: string) => {
          callbacks.onError?.(new Error(error));
          this.cancelAsync();
        })
      );
    }
  }
}

export default LlmPipe;
