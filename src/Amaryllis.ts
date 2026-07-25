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

const activeNativeGenerations = new WeakMap<LlmNativeEngine, number>();
let nextGenerationId = 1;

export const GENERATION_IN_PROGRESS_CODE = 'GENERATION_IN_PROGRESS';

export class GenerationInProgressError extends Error {
  readonly code = GENERATION_IN_PROGRESS_CODE;

  constructor(message = 'An asynchronous generation is already in progress') {
    super(message);
    this.name = 'GenerationInProgressError';
  }
}

export class LlmPipe implements LlmEngine {
  subscriptions: LlmEventSubscription[] = [];
  llmEmitter: LlmEventEmitter;
  llmNative: LlmNativeEngine;

  private activeGenerationId: number | null = null;

  constructor(params: LlmPipeParams) {
    this.llmNative = params.nativeModule;
    this.llmEmitter = params.eventEmitter;
  }

  async init(params: LlmEngineConfig): Promise<void> {
    const nativeConfig = toNativeEngineConfig(params);
    await this.llmNative.init(nativeConfig);
  }

  newSession(params?: LlmSessionParams): Promise<void> {
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
    if (activeNativeGenerations.has(this.llmNative)) {
      throw new GenerationInProgressError();
    }

    const generationId = nextGenerationId++;
    this.activeGenerationId = generationId;
    activeNativeGenerations.set(this.llmNative, generationId);

    try {
      this.setupAsyncCallbacks(callbacks ?? {}, generationId);
      const nativeParams = toNativeRequestParams(params);
      await this.llmNative.generateAsync(nativeParams);
    } catch (error) {
      this.finishAsyncGeneration(generationId);
      throw error;
    }
  }

  close(): void {
    this.cancelAsync();
    this.llmNative.close();
  }

  cancelAsync(): void {
    const generationId = this.activeGenerationId;
    if (generationId === null) {
      return;
    }

    this.releaseGeneration(generationId);
    this.llmNative.cancelAsync();
  }

  setupAsyncCallbacks(
    callbacks: LlmCallbacks,
    generationId?: number
  ): void {
    const scopedGenerationId = generationId ?? this.activeGenerationId;
    if (scopedGenerationId === null) {
      return;
    }

    if (callbacks.onPartialResult || callbacks.onEvent) {
      const subscription = this.llmEmitter.addListener(
        EVENT_ON_PARTIAL_RESULT,
        (result: string) => {
          if (!this.isActiveGeneration(scopedGenerationId)) {
            return;
          }
          try {
            callbacks.onEvent?.({ type: 'partial', text: result });
          } catch (error) {
            console.error('Error in onEvent callback:', error);
          }
          try {
            callbacks.onPartialResult?.(result);
          } catch (error) {
            console.error('Error in onPartialResult callback:', error);
          }
        }
      );
      this.subscriptions.push(subscription);
    }

    const finalSubscription = this.llmEmitter.addListener(
      EVENT_ON_FINAL_RESULT,
      (result: string) => {
        if (!this.isActiveGeneration(scopedGenerationId)) {
          return;
        }
        try {
          callbacks.onEvent?.({ type: 'final', text: result });
        } catch (error) {
          console.error('Error in onEvent callback:', error);
        }
        try {
          callbacks.onFinalResult?.(result);
        } catch (error) {
          console.error('Error in onFinalResult callback:', error);
        } finally {
          this.finishAsyncGeneration(scopedGenerationId);
        }
      }
    );
    this.subscriptions.push(finalSubscription);

    const errorSubscription = this.llmEmitter.addListener(
      EVENT_ON_ERROR,
      (error: string) => {
        if (!this.isActiveGeneration(scopedGenerationId)) {
          return;
        }
        const errorObj = new Error(error);
        try {
          callbacks.onEvent?.({ type: 'error', error: errorObj });
        } catch (callbackError) {
          console.error('Error in onEvent callback:', callbackError);
        }
        try {
          callbacks.onError?.(errorObj);
        } catch (callbackError) {
          console.error('Error in onError callback:', callbackError);
        } finally {
          this.finishAsyncGeneration(scopedGenerationId);
        }
      }
    );
    this.subscriptions.push(errorSubscription);
  }

  private isActiveGeneration(generationId: number): boolean {
    return (
      this.activeGenerationId === generationId &&
      activeNativeGenerations.get(this.llmNative) === generationId
    );
  }

  private finishAsyncGeneration(generationId: number): void {
    if (!this.isActiveGeneration(generationId)) {
      return;
    }

    this.releaseGeneration(generationId);
  }

  private releaseGeneration(generationId: number): void {
    if (this.activeGenerationId === generationId) {
      this.activeGenerationId = null;
    }
    if (activeNativeGenerations.get(this.llmNative) === generationId) {
      activeNativeGenerations.delete(this.llmNative);
    }
    this.removeSubscriptions();
  }

  private removeSubscriptions(): void {
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
}

export default LlmPipe;
