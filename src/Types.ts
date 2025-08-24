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

  // Optional generation settings
  maxTokens?: number; // default: 512
  topK?: number; // default: 40
  temperature?: number; // default: 0.8
  randomSeed?: number; // default: 0

  // Multimodal support
  images?: LlmImageInput[];

  // LoRA customization (GPU only)
  loraPath?: string;
}

// Initialization/configuration for the engine
export interface LlmEngineConfig {
  modelPath: string; // Required: .task model path on device
  maxTopK?: number; // default: 64 (for session initialization)
  enableVision?: boolean; // default: false
  maxNumImages?: number; // default: 1
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
  generateSync(params: LlmRequestParams): Promise<string>;

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
