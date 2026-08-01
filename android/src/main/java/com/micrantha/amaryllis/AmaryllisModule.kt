package com.micrantha.amaryllis

import android.util.Log
import com.facebook.react.bridge.Arguments
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
  private var activeRequestId: String? = null

  override fun getName() = NAME

  @ReactMethod
  override fun init(config: ReadableMap, promise: Promise): Unit = try {
    amaryllis.init(reactApplicationContext.applicationContext, config)
    promise.resolve(null)
  } catch (e: Amaryllis.InvalidModelPathException) {
    promise.reject(ERROR_CODE_INFER, "invalid model path", e)
  } catch (e: Throwable) {
    promise.reject(ERROR_CODE_INFER, "unable to configure", e)
  }

  @ReactMethod
  override fun newSession(params: ReadableMap?, promise: Promise) {
    try {
      amaryllis.newSession(params)
      promise.resolve(null)
    } catch (e: Amaryllis.NotInitializedException) {
      Log.e(NAME, "sdk is not initialized", e)
      promise.reject(ERROR_CODE_INFER, "sdk is not initialized", e)
    } catch (e: Throwable) {
      Log.e(NAME, "unable to initialize session", e)
      promise.reject(ERROR_CODE_SESSION, "please initialize the sdk first", e)
    }
  }

  @ReactMethod
  override fun generate(params: ReadableMap, promise: Promise) {
    try {
      val result = amaryllis.generate(params)
      promise.resolve(result)
    } catch (e: Amaryllis.SessionRequiredException) {
      Log.e(NAME, "session is required", e)
      promise.reject(ERROR_CODE_SESSION, "session is required", e)
    } catch (e: Amaryllis.NotInitializedException) {
      Log.e(NAME, "sdk is not initialized", e)
      promise.reject(ERROR_CODE_INFER, "sdk is not initialized", e)
    } catch (e: Throwable) {
      Log.e(NAME, "unable to generate response", e)
      promise.reject(ERROR_CODE_INFER, "unable to generate response", e)
    }
  }

  @ReactMethod
  @Synchronized
  override fun generateAsync(params: ReadableMap, requestId: String, promise: Promise) {
    if (activeRequestId != null) {
      promise.reject(ERROR_CODE_IN_PROGRESS, "generation already in progress")
      return
    }

    activeRequestId = requestId
    try {
      amaryllis.generateAsync(params) { partialResult, done ->
        if (!ownsRequest(requestId)) {
          return@generateAsync
        }

        val text = partialResult ?: ""
        if (done) {
          activeRequestId = null
          sendTextEvent(EVENT_ON_FINAL_RESULT, requestId, text)
        } else {
          sendTextEvent(EVENT_ON_PARTIAL_RESULT, requestId, text)
        }
      }
      promise.resolve(null)
    } catch (e: Amaryllis.SessionRequiredException) {
      activeRequestId = null
      Log.e(NAME, "session is required", e)
      promise.reject(ERROR_CODE_SESSION, "session is required", e)
    } catch (e: Amaryllis.NotInitializedException) {
      activeRequestId = null
      Log.e(NAME, "sdk is not initialized", e)
      promise.reject(ERROR_CODE_INFER, "sdk is not initialized", e)
    } catch (e: Throwable) {
      activeRequestId = null
      Log.e(NAME, "unable to generate response", e)
      sendErrorEvent(requestId, "unable to generate response", ERROR_CODE_INFER)
      promise.reject(ERROR_CODE_INFER, "unable to generate response", e)
    }
  }

  @ReactMethod
  @Synchronized
  override fun close() {
    Log.d(NAME, "closing")
    activeRequestId = null
    amaryllis.close()
  }

  @ReactMethod
  @Synchronized
  override fun cancelAsync(requestId: String) {
    if (!ownsRequest(requestId)) {
      return
    }
    activeRequestId = null
    amaryllis.cancelAsync()
  }

  @Override
  fun addListener(eventName: String) {
    // No-op
  }

  @Override
  fun removeListeners(count: Int) {
    // No-op
  }

  @Synchronized
  private fun ownsRequest(requestId: String): Boolean = activeRequestId == requestId

  private fun sendTextEvent(event: String, requestId: String, text: String) {
    val data = Arguments.createMap().apply {
      putString("requestId", requestId)
      putString("text", text)
    }
    sendEvent(event, data)
  }

  private fun sendErrorEvent(requestId: String, message: String, code: String) {
    val data = Arguments.createMap().apply {
      putString("requestId", requestId)
      putString("message", message)
      putString("code", code)
    }
    sendEvent(EVENT_ON_ERROR, data)
  }

  private fun sendEvent(event: String, data: WritableMap) {
    Log.d(NAME, "sending event $event")
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(event, data)
  }

  override fun getConstants() = mapOf(
    "EVENT_ON_PARTIAL_RESULT" to EVENT_ON_PARTIAL_RESULT,
    "EVENT_ON_FINAL_RESULT" to EVENT_ON_FINAL_RESULT,
    "EVENT_ON_ERROR" to EVENT_ON_ERROR,
    "ERROR_CODE_INFER" to ERROR_CODE_INFER,
    "ERROR_CODE_SESSION" to ERROR_CODE_SESSION,
    "ERROR_CODE_IN_PROGRESS" to ERROR_CODE_IN_PROGRESS,
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

    const val EVENT_ON_PARTIAL_RESULT = "onPartialResult"
    const val EVENT_ON_FINAL_RESULT = "onFinalResult"
    const val EVENT_ON_ERROR = "onError"

    const val ERROR_CODE_INFER = "ERR_INFER"
    const val ERROR_CODE_SESSION = "ERR_SESSION"
    const val ERROR_CODE_IN_PROGRESS = "GENERATION_IN_PROGRESS"

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
