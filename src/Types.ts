import type { Spec } from './NativeAmaryllis';
import type { Observable } from 'rxjs';

export type LlmNativeEngine = Spec;

/**
 * Low-level asynchronous engine event.
 *
 * Partial and final text values are incremental deltas. Consumers that use
 * `onEvent` directly must accumulate them. `useInferenceAsync` performs that
 * accumulation and exposes cumulative snapshots through `onResult`.
 */
export type LlmEvent =
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'error'; error: Error };

export type LlmCallbacks = {
  /**
   * Low-level request-scoped event callback. Partial and final text values are
   * deltas; the final delta may be empty.
   */
  onEvent?: (event: LlmEvent) => void;
  /** @deprecated Use onEvent instead. Receives an incremental text delta. */
  onPartialResult?: (result: string) => void;
  /**
   * @deprecated Use onEvent or useInferenceAsync instead. Receives the complete
   * accumulated final output.
   */
  onFinalResult?: (result: string) => void;
  /** @deprecated Use onEvent instead. */
  onError?: (err: Error) => void;
};

export type LlmAsyncLifecycleEvent = { type: 'cancelled' } | { type: 'closed' };

// Core parameter object for configuration and request options
export type LlmRequestParams = {
  // Required
  prompt: string;
  // Multimodal support
  images?: string[];
};

export type LlmProtocol = {
  formatRequest(params: LlmRequestParams): LlmRequestParams;
  sanitizeOutput(text: string): string;
};

export type LlmSessionParams = {
  // Optional generation settings
  topK?: number; // default: 40
  topP?: number; // default: 0.95
  temperature?: number; // default: 0.8
  randomSeed?: number; // default: 0
  loraPath?: string; // LoRA customization (GPU only)
  enableVisionModality?: boolean;
};

// Initialization/configuration for the engine
export type LlmEngineConfig = {
  modelPath: string; // Required: .task model path on device
  maxTopK?: number; // default: 64 (for session initialization)
  maxNumImages?: number; // default: 1
  maxTokens?: number; // default: 512
  visionEncoderPath?: string; // Optional: vision encoder model path for multimodal
  visionAdapterPath?: string; // Optional: vision adapter model path for multimodal
  protocol?: LlmProtocol; // Optional model-specific request/response shaping
};

// Unified LLM interface
export type LlmEngine = {
  /**
   * Initialize the engine (creates LlmInference and LlmInferenceSession internally).
   */
  init(config: LlmEngineConfig): Promise<void>;

  /**
   * Start a new session.
   */
  newSession(params?: LlmSessionParams): Promise<void>;

  /**
   * Generate a response synchronously (blocking).
   */
  generate(params: LlmRequestParams): Promise<string>;

  /**
   * Start an asynchronous request-scoped generation.
   *
   * The promise resolves after validation and native startup, not after the
   * model reaches a terminal state. Observe callbacks for results and
   * completion. Only one synchronous or asynchronous generation may own a
   * native module at a time.
   */
  generateAsync(
    params: LlmRequestParams,
    callbacks?: LlmCallbacks
  ): Promise<void>;

  /**
   * Clean up resources. Closing may cancel active work owned by this engine.
   */
  close(): void;

  /**
   * Cancel the asynchronous generation owned by this engine. The operation is
   * request-scoped and is a no-op after settlement or when no owned request is
   * active.
   */
  cancelAsync(): void;

  /**
   * Observe controller-level cancellation and close operations.
   *
   * Optional for custom engines so existing implementations remain compatible.
   */
  subscribeAsyncLifecycle?(
    listener: (event: LlmAsyncLifecycleEvent) => void
  ): () => void;
};

export interface LlmEventSubscription {
  remove: () => void;
}

export interface LlmEventEmitter {
  addListener(event: string, cb: (result: any) => void): LlmEventSubscription;
}

export interface LlmPipeParams {
  nativeModule: LlmNativeEngine;
  eventEmitter: LlmEventEmitter;
}

export interface LLMContextValue {
  config: LlmEngineConfig | null;
  controller: LlmEngine | null;
  error: Error | undefined;
  isReady: boolean;
}

export interface LLMProviderProps {
  config: LlmEngineConfig;
  llmPipe?: LlmEngine;
  children: React.ReactNode;
}

export type InferenceProps = {
  onGenerate?: () => void;
  /**
   * Receives the complete accumulated output produced so far. Replace displayed
   * text rather than appending this value. `isFinal` is true exactly once for a
   * successful generation and that result contains the complete final output.
   */
  onResult?: (result: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  /**
   * Terminal lifecycle notification for success, error, or explicit
   * cancellation. Completion does not by itself imply successful generation.
   */
  onComplete?: () => void;
};

export interface LLMResult {
  /** Complete accumulated output produced so far. */
  text: string;
  isFinal: boolean;
}

export interface LLMObservableResult {
  callbacks: LlmCallbacks;
  observable: Observable<LLMResult>;
}
