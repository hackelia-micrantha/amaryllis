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
import com.google.mediapipe.tasks.genai.llminference.VisionModelOptions


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
      .setVisionModelOptions(VisionModelOptions.builder()
        .setAdapterPath(config.getString(PARAM_VISION_ADAPTER))
        .setEncoderPath(config.getString(PARAM_VISION_ENCODER))
        .build())
      .build()

    llmInference = LlmInference.createFromOptions(reactContext, taskOptions)

    this.session = this.initSession(config.getMap(PARAM_NEW_SESSION))

    promise.resolve(null)
  } catch (e: Throwable) {
    promise.reject(ERROR_CODE_INFER, "unable to configure", e)
  }

  @ReactMethod
  override fun generate(params: ReadableMap, promise: Promise) {
    try {
      this.updateOrInitSession(params) { session ->
        val result = session.generateResponse()
        promise.resolve(result)
      }
    } catch (e: Throwable) {
      promise.reject(ERROR_CODE_INFER, "unable to generate response", e)
    }
  }

  @ReactMethod
  override fun generateAsync(params: ReadableMap, promise: Promise) {
    try {
      this.updateOrInitSession(params) { session ->
        session.generateResponseAsync { partialResult, done ->
          if (!done) {
            sendEvent(EVENT_ON_PARTIAL_RESULT, partialResult)
          } else {
            sendEvent(EVENT_ON_FINAL_RESULT, partialResult)
          }
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

  private fun initSession(config: ReadableMap?): LlmInferenceSession {
    val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()

    config?.getInt(PARAM_TOP_K)?.let { sessionOptions.setTopK(it) }
    config?.getDouble(PARAM_TOP_P)?.let { sessionOptions.setTopP(it.toFloat()) }
    config?.getDouble(PARAM_TEMPERATURE)?.let { sessionOptions.setTemperature(it.toFloat()) }
    config?.getInt(PARAM_RANDOM_SEED)?.let { sessionOptions.setRandomSeed(it) }
    config?.getString(PARAM_LORA_PATH)?.let { sessionOptions.setLoraPath(it) }
    config?.getBoolean(PARAM_ENABLE_VISION)?.let {
      sessionOptions.setGraphOptions(
        GraphOptions.builder()
          .setEnableVisionModality(it)
          .build()
      )
    }

    return LlmInferenceSession.createFromOptions(llmInference!!, sessionOptions.build())
  }

  private fun updateOrInitSession(params: ReadableMap, onSessionReady: (LlmInferenceSession) -> Unit) {
    val newSession = params.getMap(PARAM_NEW_SESSION)

    val session = if (session == null || newSession != null) {
      this.session?.close()
      this.initSession(newSession)
    } else this.session!!

    session.addQueryChunk(params.getString(PARAM_PROMPT) ?: "")
    params.getArray(PARAM_IMAGES)?.run {
      preprocessImages(this).forEach {
        session.addImage(it)
      }
    }
    onSessionReady(session)
  }

  override fun getConstants() = mapOf(
    // events
    "EVENT_ON_PARTIAL_RESULT" to EVENT_ON_PARTIAL_RESULT,
    "EVENT_ON_FINAL_RESULT" to EVENT_ON_FINAL_RESULT,
    "EVENT_ON_ERROR" to EVENT_ON_ERROR,
    // errors
    "ERROR_CODE_INFER" to ERROR_CODE_INFER,
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
    "PARAM_NEW_SESSION" to PARAM_NEW_SESSION,
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
    const val PARAM_NEW_SESSION = "newSession"
    const val PARAM_ENABLE_VISION = "enableVisionModality"


    fun LlmInferenceSession.LlmInferenceSessionOptions.Builder.from(params: ReadableMap?): LlmInferenceSession.LlmInferenceSessionOptions {
      if (params == null) return build()

      if (params.hasKey(PARAM_TEMPERATURE)) setTemperature(params.getDouble(PARAM_TEMPERATURE).toFloat())
      if (params.hasKey(PARAM_TOP_K)) setTopK(params.getInt(PARAM_TOP_K))
      if (params.hasKey(PARAM_TOP_P)) setTopP(params.getDouble(PARAM_TOP_P).toFloat())
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
