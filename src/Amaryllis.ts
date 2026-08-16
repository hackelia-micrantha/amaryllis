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
  LlmAsyncLifecycleEvent,
} from './Types';
import {
  toNativeEngineConfig,
  toNativeSessionParams,
  toNativeRequestParams,
} from './TypeConverters';
import { GenerationInProgressError } from './Errors';

const EVENT_ON_PARTIAL_RESULT = 'onPartialResult';
const EVENT_ON_FINAL_RESULT = 'onFinalResult';
const EVENT_ON_ERROR = 'onError';
const EVENT_ON_CANCELLED = 'onCancelled';

type AsyncOperationPhase = 'generating' | 'cancelling';

type NativeOperation =
  | {
      id: number;
      kind: 'sync';
      owner: LlmPipe;
    }
  | {
      id: number;
      kind: 'async';
      owner: LlmPipe;
      phase: AsyncOperationPhase;
      notifyCancellation: boolean;
    };

type NativeTextEvent = {
  requestId: string;
  text: string;
  finalText?: string;
};

type NativeErrorEvent = {
  requestId: string;
  message: string;
  code?: string;
};

type NativeCancelledEvent = {
  requestId: string;
};

const activeNativeOperations = new WeakMap<LlmNativeEngine, NativeOperation>();
const closingNativeEngines = new WeakSet<LlmNativeEngine>();
let nextOperationId = 1;

export class LlmPipe implements LlmEngine {
  subscriptions: LlmEventSubscription[] = [];
  llmEmitter: LlmEventEmitter;
  llmNative: LlmNativeEngine;

  private activeGenerationId: number | null = null;
  private closeRequested = false;
  private asyncLifecycleListeners = new Set<
    (event: LlmAsyncLifecycleEvent) => void
  >();

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
    const operationId = this.claimNativeOperation('sync');
    let generationFailed = false;
    try {
      const nativeParams = toNativeRequestParams(params);
      return await this.llmNative.generate(nativeParams);
    } catch (error) {
      generationFailed = true;
      throw error;
    } finally {
      this.releaseNativeOperation(operationId);
      if (this.closeRequested) {
        try {
          this.close();
        } catch (error) {
          if (!generationFailed) {
            throw error;
          }
          console.warn('Failed to close after generation failure:', error);
        }
      }
    }
  }

  async generateAsync(
    params: LlmRequestParams,
    callbacks?: LlmCallbacks
  ): Promise<void> {
    const generationId = this.claimNativeOperation('async');
    this.activeGenerationId = generationId;

    try {
      this.setupAsyncCallbacks(callbacks ?? {}, generationId);
      const nativeParams = toNativeRequestParams(params);
      await this.llmNative.generateAsync(nativeParams, String(generationId));
    } catch (error) {
      if (closingNativeEngines.has(this.llmNative)) {
        throw error;
      }

      const activeOperation = this.getActiveAsyncOperation(generationId);
      if (activeOperation?.phase === 'cancelling') {
        const notifyCancellation = activeOperation.notifyCancellation;
        if (this.releaseNativeOperation(generationId) && notifyCancellation) {
          this.notifyAsyncLifecycle({ type: 'cancelled' });
        }
      } else {
        this.finishAsyncGeneration(generationId);
      }
      throw error;
    }
  }

  close(): void {
    const activeOperation = activeNativeOperations.get(this.llmNative);
    if (activeOperation && activeOperation.owner !== this) {
      return;
    }
    if (activeOperation?.kind === 'sync') {
      this.closeRequested = true;
      return;
    }

    closingNativeEngines.add(this.llmNative);
    let closeSucceeded = false;
    try {
      if (activeOperation?.kind === 'async') {
        try {
          this.cancelOwnedAsync(false);
        } catch (error) {
          console.warn('Failed to cancel generation while closing:', error);
        }
      }

      this.llmNative.close();

      if (activeOperation?.kind === 'async') {
        this.releaseNativeOperation(activeOperation.id);
      }
      this.notifyAsyncLifecycle({ type: 'closed' });
      closeSucceeded = true;
    } finally {
      this.closeRequested = false;
      if (closeSucceeded) {
        closingNativeEngines.delete(this.llmNative);
      }
    }
  }

  cancelAsync(): void {
    this.cancelOwnedAsync(true);
  }

  subscribeAsyncLifecycle(
    listener: (event: LlmAsyncLifecycleEvent) => void
  ): () => void {
    this.asyncLifecycleListeners.add(listener);
    return () => {
      this.asyncLifecycleListeners.delete(listener);
    };
  }

  setupAsyncCallbacks(callbacks: LlmCallbacks, generationId?: number): void {
    const scopedGenerationId = generationId ?? this.activeGenerationId;
    if (scopedGenerationId === null) {
      return;
    }
    const requestId = String(scopedGenerationId);

    if (callbacks.onPartialResult || callbacks.onEvent) {
      const subscription = this.llmEmitter.addListener(
        EVENT_ON_PARTIAL_RESULT,
        (payload: NativeTextEvent | string) => {
          const result = this.normalizeTextEvent(payload, requestId);
          if (!result || !this.isGenerating(scopedGenerationId)) {
            return;
          }
          try {
            callbacks.onEvent?.({ type: 'partial', text: result.text });
          } catch (error) {
            console.error('Error in onEvent callback:', error);
          }
          try {
            callbacks.onPartialResult?.(result.text);
          } catch (error) {
            console.error('Error in onPartialResult callback:', error);
          }
        }
      );
      this.subscriptions.push(subscription);
    }

    const finalSubscription = this.llmEmitter.addListener(
      EVENT_ON_FINAL_RESULT,
      (payload: NativeTextEvent | string) => {
        const result = this.normalizeTextEvent(payload, requestId);
        if (!result || !this.isGenerating(scopedGenerationId)) {
          return;
        }

        this.releaseNativeOperation(scopedGenerationId);
        try {
          callbacks.onEvent?.({ type: 'final', text: result.text });
        } catch (error) {
          console.error('Error in onEvent callback:', error);
        }
        try {
          callbacks.onFinalResult?.(result.finalText ?? result.text);
        } catch (error) {
          console.error('Error in onFinalResult callback:', error);
        }
      }
    );
    this.subscriptions.push(finalSubscription);

    const errorSubscription = this.llmEmitter.addListener(
      EVENT_ON_ERROR,
      (payload: NativeErrorEvent | string) => {
        const result = this.normalizeErrorEvent(payload, requestId);
        if (!result || !this.isGenerating(scopedGenerationId)) {
          return;
        }

        this.releaseNativeOperation(scopedGenerationId);
        const errorObj = new Error(result.message);
        if (result.code) {
          Object.assign(errorObj, { code: result.code });
        }
        try {
          callbacks.onEvent?.({ type: 'error', error: errorObj });
        } catch (callbackError) {
          console.error('Error in onEvent callback:', callbackError);
        }
        try {
          callbacks.onError?.(errorObj);
        } catch (callbackError) {
          console.error('Error in onError callback:', callbackError);
        }
      }
    );
    this.subscriptions.push(errorSubscription);

    const cancelledSubscription = this.llmEmitter.addListener(
      EVENT_ON_CANCELLED,
      (payload: NativeCancelledEvent) => {
        const result = this.normalizeCancelledEvent(payload, requestId);
        if (!result || closingNativeEngines.has(this.llmNative)) {
          return;
        }

        const activeOperation = this.getActiveAsyncOperation(scopedGenerationId);
        if (!activeOperation || activeOperation.phase !== 'cancelling') {
          return;
        }

        const notifyCancellation = activeOperation.notifyCancellation;
        if (!this.releaseNativeOperation(scopedGenerationId)) {
          return;
        }
        if (notifyCancellation) {
          this.notifyAsyncLifecycle({ type: 'cancelled' });
        }
      }
    );
    this.subscriptions.push(cancelledSubscription);
  }

  private normalizeTextEvent(
    payload: NativeTextEvent | string,
    requestId: string
  ): NativeTextEvent | null {
    if (typeof payload === 'string') {
      return { requestId, text: payload };
    }
    if (
      !payload ||
      payload.requestId !== requestId ||
      typeof payload.text !== 'string' ||
      (payload.finalText !== undefined && typeof payload.finalText !== 'string')
    ) {
      return null;
    }
    return payload;
  }

  private normalizeErrorEvent(
    payload: NativeErrorEvent | string,
    requestId: string
  ): NativeErrorEvent | null {
    if (typeof payload === 'string') {
      return { requestId, message: payload };
    }
    if (
      !payload ||
      payload.requestId !== requestId ||
      typeof payload.message !== 'string'
    ) {
      return null;
    }
    return payload;
  }

  private normalizeCancelledEvent(
    payload: NativeCancelledEvent,
    requestId: string
  ): NativeCancelledEvent | null {
    if (!payload || payload.requestId !== requestId) {
      return null;
    }
    return payload;
  }

  private claimNativeOperation(kind: NativeOperation['kind']): number {
    if (
      closingNativeEngines.has(this.llmNative) ||
      activeNativeOperations.has(this.llmNative)
    ) {
      throw new GenerationInProgressError();
    }

    const operationId = nextOperationId++;
    const operation: NativeOperation =
      kind === 'async'
        ? {
            id: operationId,
            kind,
            owner: this,
            phase: 'generating',
            notifyCancellation: false,
          }
        : { id: operationId, kind, owner: this };
    activeNativeOperations.set(this.llmNative, operation);
    return operationId;
  }

  private cancelOwnedAsync(notifyLifecycle: boolean): void {
    const activeOperation = this.getActiveAsyncOperation(
      this.activeGenerationId
    );
    if (!activeOperation || activeOperation.phase === 'cancelling') {
      return;
    }

    activeOperation.phase = 'cancelling';
    activeOperation.notifyCancellation = notifyLifecycle;
    try {
      this.llmNative.cancelAsync(String(activeOperation.id));
    } catch (error) {
      activeOperation.phase = 'generating';
      activeOperation.notifyCancellation = false;
      throw error;
    }
  }

  private getActiveAsyncOperation(
    generationId: number | null
  ): Extract<NativeOperation, { kind: 'async' }> | null {
    if (generationId === null) {
      return null;
    }
    const activeOperation = activeNativeOperations.get(this.llmNative);
    if (
      !activeOperation ||
      activeOperation.kind !== 'async' ||
      activeOperation.owner !== this ||
      activeOperation.id !== generationId ||
      this.activeGenerationId !== generationId
    ) {
      return null;
    }
    return activeOperation;
  }

  private isGenerating(generationId: number): boolean {
    return this.getActiveAsyncOperation(generationId)?.phase === 'generating';
  }

  private finishAsyncGeneration(generationId: number): void {
    const activeOperation = this.getActiveAsyncOperation(generationId);
    if (!activeOperation || activeOperation.phase !== 'generating') {
      return;
    }

    this.releaseNativeOperation(generationId);
  }

  private releaseNativeOperation(operationId: number): boolean {
    const activeOperation = activeNativeOperations.get(this.llmNative);
    if (
      !activeOperation ||
      activeOperation.id !== operationId ||
      activeOperation.owner !== this
    ) {
      return false;
    }

    activeNativeOperations.delete(this.llmNative);
    if (activeOperation.kind === 'async') {
      if (this.activeGenerationId === operationId) {
        this.activeGenerationId = null;
      }
      this.removeSubscriptions();
    }
    return true;
  }

  private notifyAsyncLifecycle(event: LlmAsyncLifecycleEvent): void {
    [...this.asyncLifecycleListeners].forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Failed to notify async lifecycle listener:', error);
      }
    });
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
