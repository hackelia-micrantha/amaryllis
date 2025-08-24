export interface LlmImageInput {
  uri: string; // Local file path or asset path
  width?: number; // Optional: image width
  height?: number; // Optional: image height
}

export interface LlmCallbacks {
  // Async streaming callbacks
  onPartialResult?: (partial: string) => void;
  onFinalResult?: (partial: string) => void;
  onError?: (err: Error) => void;
}

// Core parameter object for configuration and request options
export interface LlmRequestParams {
  // Required
  prompt: string;

  // Multimodal support
  images?: LlmImageInput[];

  newSession?: LlmSessionParams; // default: false
}

export interface LlmSessionParams {
  // Optional generation settings
  topK?: number; // default: 40
  topP?: number; // default: 0.95
  temperature?: number; // default: 0.8
  randomSeed?: number; // default: 0
  loraPath?: string; // LoRA customization (GPU only)
  enableVisionModality?: boolean;
}

// Initialization/configuration for the engine
export interface LlmEngineConfig {
  modelPath: string; // Required: .task model path on device
  maxTopK?: number; // default: 64 (for session initialization)
  maxNumImages?: number; // default: 1
  maxTokens?: number; // default: 512
  visionEncoderPath?: string; // Optional: vision encoder model path for multimodal
  visionAdapterPath?: string; // Optional: vision adapter model path for multimodal
  newSession?: LlmSessionParams;
}

// Unified LLM interface
export interface LlmEngine {
  /**
   * Initialize the engine (creates LlmInference and LlmInferenceSession internally).
   */
  init(config: LlmEngineConfig): Promise<void>;

  /**
   * Generate a response synchronously (blocking).
   */
  generate(params: LlmRequestParams): Promise<string>;

  /**
   * Generate a response asynchronously (streaming).
   */
  generateAsync(params: LlmRequestParams, callbacks?: LlmCallbacks): void;

  /**
   * Clean up resources.
   */
  close(): void;

  cancelAsync(): void;
}
