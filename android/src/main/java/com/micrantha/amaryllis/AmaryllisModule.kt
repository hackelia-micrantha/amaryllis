package com.micrantha.amaryllis

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession


@ReactModule(name = AmaryllisModule.NAME)
class AmaryllisModule(private val reactContext: ReactApplicationContext) :
  NativeAmaryllisSpec(reactContext) {

  private var llmInference: LlmInference? = null
  private var session: LlmInferenceSession? = null

  override fun getName() = NAME

  @ReactMethod
  override fun init(config: ReadableMap, promise: Promise): Unit = try {
    val taskOptions = LlmInference.LlmInferenceOptions.builder()
      .setModelPath(config.getString(PARAM_MODEL_PATH))
      .setMaxTopK(config.getInt(PARAM_MAX_TOP_K))
      .setMaxTokens(config.getInt(PARAM_MAX_TOKENS))
      .setMaxNumImages(config.getInt(PARAM_MAX_NUM_IMAGES))
      .build()

    llmInference = LlmInference.createFromOptions(reactContext, taskOptions)

    val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()
      .from(config)

    session = LlmInferenceSession.createFromOptions(llmInference!!, sessionOptions)
    promise.resolve(null)
  } catch (e: Throwable) {
    promise.reject(ERROR_CODE_INFER, "unable to configure", e)
  }

  @ReactMethod
  override fun generate(params: ReadableMap, promise: Promise) {
    try {
      val session = session ?: throw IllegalStateException("Session not initialized")
      session.updateSessionOptions { builder ->
        builder.from(params)
      }
      session.addQueryChunk(params.getString(PARAM_PROMPT) ?: "")
      params.getArray(PARAM_IMAGES)?.run {
        preprocessImages(this).forEach {
          session.addImage(it)
        }
      }
      val result = session.generateResponse()
      promise.resolve(result)
    } catch (e: Throwable) {
      promise.reject(ERROR_CODE_INFER, "unable to generate response", e)
    }
  }

  @ReactMethod
  override fun generateAsync(params: ReadableMap, promise: Promise) {
    try {
      val session = session ?: throw IllegalStateException("Session not initialized")
      session.updateSessionOptions { builder ->
        builder.from(params)
      }
      session.addQueryChunk(params.getString(PARAM_PROMPT) ?: "")
      params.getArray(PARAM_IMAGES)?.run {
        preprocessImages(this).forEach {
          session.addImage(it)
        }
      }
      session.generateResponseAsync { partialResult, done ->
        if (!done) {
          sendEvent(EVENT_ON_PARTIAL_RESULT, partialResult)
        } else {
          sendEvent(EVENT_ON_FINAL_RESULT, partialResult)
        }
      }
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject(ERROR_CODE_INFER, "unable to generate response", e)
    }
  }

  @ReactMethod
  override fun close() {
    session?.close()
    llmInference?.close()
    session = null
    llmInference = null
  }

  @ReactMethod
  override fun cancelAsync() {
    session?.cancelGenerateResponseAsync()
  }

  private fun sendEvent(event: String, data: String) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(event, data)
  }

  companion object {
    const val NAME = "Amaryllis"

    const val EVENT_ON_PARTIAL_RESULT = "onPartialResult"
    const val EVENT_ON_FINAL_RESULT = "onFinalResult"
    const val EVENT_ON_ERROR = "onError"
    const val ERROR_CODE_INFER = "ERR_INFER"

    const val PARAM_IMAGES = "images"
    const val PARAM_PROMPT = "prompt"
    const val PARAM_MAX_TOP_K = "maxTopK"
    const val PARAM_MAX_TOKENS = "maxTokens"
    const val PARAM_MAX_NUM_IMAGES = "maxNumImages"
    const val PARAM_ENABLE_VISION = "enableVision"
    const val PARAM_MODEL_PATH = "modelPath"
    const val PARAM_TEMPERATURE = "temperature"
    const val PARAM_RANDOM_SEED = "randomSeed"
    const val PARAM_LORA_PATH = "loraPath"
    const val PARAM_TOP_K = "topK"


    fun LlmInferenceSession.LlmInferenceSessionOptions.Builder.from(params: ReadableMap?): LlmInferenceSession.LlmInferenceSessionOptions {
      if (params == null) return build()

      if (params.hasKey(PARAM_TEMPERATURE)) setTemperature(params.getDouble(PARAM_TEMPERATURE).toFloat())
      if (params.hasKey(PARAM_TOP_K)) setTopK(params.getInt("topK"))
      if (params.hasKey(PARAM_RANDOM_SEED)) setRandomSeed(params.getInt(PARAM_RANDOM_SEED))
      params.getString(PARAM_LORA_PATH)?.let { setLoraPath(it) }
      if (params.hasKey(PARAM_ENABLE_VISION)) {
        setGraphOptions(
          GraphOptions.builder()
            .setEnableVisionModality(params.getBoolean(PARAM_ENABLE_VISION))
            .build()
        )
      }
      return build()
    }
  }
}
