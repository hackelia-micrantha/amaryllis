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
  init(config: LlmEngineConfig, newSession?: LlmSessionParams): Promise<void>;

  /**
   * Generate a response synchronously (blocking).
   */
  generate(
    params: LlmRequestParams,
    newSession?: LlmSessionParams
  ): Promise<string>;

  /**
   * Generate a response asynchronously (streaming).
   */
  generateAsync(
    params: LlmRequestParams,
    newSession?: LlmSessionParams,
    callbacks?: LlmCallbacks
  ): Promise<void>;

  /**
   * Clean up resources.
   */
  close(): void;

  cancelAsync(): void;
};
