import type { Spec } from './NativeAmaryllis';
import type { Observable } from 'rxjs';

export type LlmNativeEngine = Spec;

export type LlmCallbacks = {
  // Async streaming callbacks
  onPartialResult?: (result: string) => void;
  onFinalResult?: (result: string) => void;
  onError?: (err: Error) => void;
};

// Core parameter object for configuration and request options
export type LlmRequestParams = {
  // Required
  prompt: string;
  // Multimodal support
  images?: string[];
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
  newSession(params: LlmSessionParams): Promise<void>;

  /**
   * Generate a response synchronously (blocking).
   */
  generate(params: LlmRequestParams): Promise<string>;

  /**
   * Generate a response asynchronously (streaming).
   */
  generateAsync(
    params: LlmRequestParams,
    callbacks?: LlmCallbacks
  ): Promise<void>;

  /**
   * Clean up resources.
   */
  close(): void;

  cancelAsync(): void;
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
  onResult?: (result: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
};

export interface LLMResult {
  text: string;
  isFinal: boolean;
}

export interface LLMObservableResult {
  callbacks: LlmCallbacks;
  observable: Observable<LLMResult>;
}
