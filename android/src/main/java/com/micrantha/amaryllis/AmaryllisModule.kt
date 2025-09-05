package com.micrantha.amaryllis

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = AmaryllisModule.NAME)
class AmaryllisModule(reactContext: ReactApplicationContext) :
  NativeAmaryllisSpec(reactContext) {

  private val amaryllis = Amaryllis()

  override fun getName() = NAME

  @ReactMethod
  override fun init(config: ReadableMap, promise: Promise): Unit = try {
    amaryllis.init(reactApplicationContext.applicationContext, config)
    promise.resolve(null)
  } catch (e: Throwable) {
    promise.reject(ERROR_CODE_INFER, "unable to configure", e)
  }

  @ReactMethod
  override fun newSession(params: ReadableMap?, promise: Promise) {
    try {
      amaryllis.newSession(params)
    } catch (e: Throwable) {
      promise.reject(ERROR_CODE_SESSION, "please initialize the sdk first", e)
    }
  }

  @ReactMethod
  override fun generate(params: ReadableMap, promise: Promise) {
    try {
      val result = amaryllis.generate(params)
      promise.resolve(result)
    } catch (e: Throwable) {
      promise.reject(ERROR_CODE_INFER, "unable to generate response", e)
    }
  }

  @ReactMethod
  override fun generateAsync(params: ReadableMap, promise: Promise) {
    try {
      amaryllis.generateAsync(params){ partialResult, done ->
        if (done) {
          sendEvent(EVENT_ON_FINAL_RESULT, partialResult ?: "")
        } else {
          sendEvent(EVENT_ON_PARTIAL_RESULT, partialResult ?: "")
        }
      }
      promise.resolve(null)
    } catch (e: Throwable) {
      sendEvent(EVENT_ON_ERROR, "unable to generate response")
      promise.reject(ERROR_CODE_INFER, "unable to generate response", e)
    }
  }

  @ReactMethod
  override fun close() {
    Log.d(NAME, "closing")
    amaryllis.close()
  }

  @ReactMethod
  override fun cancelAsync() {
    amaryllis.cancelAsync()
  }

  @Override
  fun addListener( eventName: String) {
    // No-op
  }

  @Override
  fun removeListeners(count: Int) {
    // No-op
  }

  fun emitEvent(name: String, data: WritableMap) {
    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, data);
  }

  private fun sendEvent(event: String, data: String) {
    Log.d(NAME, "sending event $event")
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(event, data)
  }

  override fun getConstants() = mapOf(
    // events
    "EVENT_ON_PARTIAL_RESULT" to EVENT_ON_PARTIAL_RESULT,
    "EVENT_ON_FINAL_RESULT" to EVENT_ON_FINAL_RESULT,
    "EVENT_ON_ERROR" to EVENT_ON_ERROR,
    // errors
    "ERROR_CODE_INFER" to ERROR_CODE_INFER,
    "ERROR_CODE_SESSION" to ERROR_CODE_SESSION,
    // params
    "PARAM_IMAGES" to PARAM_IMAGES,
    "PARAM_PROMPT" to PARAM_PROMPT,
    "PARAM_MAX_TOP_K" to PARAM_MAX_TOP_K,
    "PARAM_MAX_TOKENS" to PARAM_MAX_TOKENS,
    "PARAM_MAX_NUM_IMAGES" to PARAM_MAX_NUM_IMAGES,
    "PARAM_VISION_ENCODER" to PARAM_VISION_ENCODER,
    "PARAM_VISION_ADAPTER" to PARAM_VISION_ADAPTER,
    "PARAM_MODEL_PATH" to PARAM_MODEL_PATH,
    "PARAM_TEMPERATURE" to PARAM_TEMPERATURE,
    "PARAM_RANDOM_SEED" to PARAM_RANDOM_SEED,
    "PARAM_LORA_PATH" to PARAM_LORA_PATH,
    "PARAM_TOP_K" to PARAM_TOP_K,
    "PARAM_TOP_P" to PARAM_TOP_P,
    "PARAM_ENABLE_VISION" to PARAM_ENABLE_VISION
  )

  companion object {
    const val NAME = "Amaryllis"

    // Events
    const val EVENT_ON_PARTIAL_RESULT = "onPartialResult"
    const val EVENT_ON_FINAL_RESULT = "onFinalResult"
    const val EVENT_ON_ERROR = "onError"

    // Errors
    const val ERROR_CODE_INFER = "ERR_INFER"
    const val ERROR_CODE_SESSION = "ERR_SESSION"

    // Params
    const val PARAM_IMAGES = "images"
    const val PARAM_PROMPT = "prompt"
    const val PARAM_MAX_TOP_K = "maxTopK"
    const val PARAM_MAX_TOKENS = "maxTokens"
    const val PARAM_MAX_NUM_IMAGES = "maxNumImages"
    const val PARAM_VISION_ENCODER = "visionEncoderPath"
    const val PARAM_VISION_ADAPTER = "visionAdapterPath"
    const val PARAM_MODEL_PATH = "modelPath"
    const val PARAM_TEMPERATURE = "temperature"
    const val PARAM_RANDOM_SEED = "randomSeed"
    const val PARAM_LORA_PATH = "loraPath"
    const val PARAM_TOP_K = "topK"
    const val PARAM_TOP_P = "topP"
    const val PARAM_ENABLE_VISION = "enableVisionModality"
  }
}
