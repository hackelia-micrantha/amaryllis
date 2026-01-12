import type {
  LlmEngineConfig,
  LlmSessionParams,
  LlmRequestParams,
} from './Types';

/**
 * Convert rich LlmEngineConfig to codegen-compatible object structure
 */
export function toNativeEngineConfig(config: LlmEngineConfig) {
  return {
    modelPath: config.modelPath,
    maxTopK: config.maxTopK,
    maxNumImages: config.maxNumImages,
    maxTokens: config.maxTokens,
    visionEncoderPath: config.visionEncoderPath,
    visionAdapterPath: config.visionAdapterPath,
  };
}

/**
 * Convert codegen-compatible config object to rich LlmEngineConfig
 */
export function fromNativeEngineConfig(native: any): LlmEngineConfig {
  return {
    modelPath: native.modelPath,
    maxTopK: native.maxTopK,
    maxNumImages: native.maxNumImages,
    maxTokens: native.maxTokens,
    visionEncoderPath: native.visionEncoderPath,
    visionAdapterPath: native.visionAdapterPath,
  };
}

/**
 * Convert rich LlmSessionParams to codegen-compatible object structure
 */
export function toNativeSessionParams(params?: LlmSessionParams) {
  if (!params) return undefined;

  return {
    topK: params.topK,
    topP: params.topP,
    temperature: params.temperature,
    randomSeed: params.randomSeed,
    loraPath: params.loraPath,
    enableVisionModality: params.enableVisionModality,
  };
}

/**
 * Convert codegen-compatible session object to rich LlmSessionParams
 */
export function fromNativeSessionParams(
  native?: any
): LlmSessionParams | undefined {
  if (!native) return undefined;

  return {
    topK: native.topK,
    topP: native.topP,
    temperature: native.temperature,
    randomSeed: native.randomSeed,
    loraPath: native.loraPath,
    enableVisionModality: native.enableVisionModality,
  };
}

/**
 * Convert rich LlmRequestParams to codegen-compatible object structure
 */
export function toNativeRequestParams(params: LlmRequestParams) {
  return {
    prompt: params.prompt,
    images: params.images,
  };
}

/**
 * Convert codegen-compatible request object to rich LlmRequestParams
 */
export function fromNativeRequestParams(native: any): LlmRequestParams {
  return {
    prompt: native.prompt,
    images: native.images,
  };
}
