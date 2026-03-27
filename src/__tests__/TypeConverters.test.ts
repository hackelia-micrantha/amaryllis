import {
  fromNativeEngineConfig,
  fromNativeRequestParams,
  fromNativeSessionParams,
  toNativeEngineConfig,
  toNativeRequestParams,
  toNativeSessionParams,
} from '../TypeConverters';
import type {
  LlmEngineConfig,
  LlmRequestParams,
  LlmSessionParams,
} from '../Types';

describe('TypeConverters', () => {
  it('should round-trip engine config values', () => {
    const config: LlmEngineConfig = {
      modelPath: '/models/amaryllis.task',
      maxTopK: 48,
      maxNumImages: 2,
      maxTokens: 1024,
      visionEncoderPath: '/models/vision.encoder',
      visionAdapterPath: '/models/vision.adapter',
    };

    expect(fromNativeEngineConfig(toNativeEngineConfig(config))).toEqual(
      config
    );
  });

  it('should preserve undefined optional session params', () => {
    expect(toNativeSessionParams()).toBeUndefined();
    expect(fromNativeSessionParams()).toBeUndefined();
  });

  it('should round-trip session params values', () => {
    const params: LlmSessionParams = {
      topK: 32,
      topP: 0.9,
      temperature: 0.7,
      randomSeed: 7,
      loraPath: '/models/style.lora',
      enableVisionModality: true,
    };

    expect(fromNativeSessionParams(toNativeSessionParams(params))).toEqual(
      params
    );
  });

  it('should round-trip request params including images', () => {
    const params: LlmRequestParams = {
      prompt: 'describe this image',
      images: ['file:///tmp/one.png', 'file:///tmp/two.png'],
    };

    expect(fromNativeRequestParams(toNativeRequestParams(params))).toEqual(
      params
    );
  });
});
