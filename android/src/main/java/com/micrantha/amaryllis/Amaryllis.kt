package com.micrantha.amaryllis

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.ReadableMap
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import com.google.mediapipe.tasks.genai.llminference.ProgressListener
import com.google.mediapipe.tasks.genai.llminference.VisionModelOptions
import com.micrantha.amaryllis.AmaryllisModule.Companion.NAME
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_ENABLE_VISION
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_IMAGES
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_LORA_PATH
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_MAX_NUM_IMAGES
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_MAX_TOKENS
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_MAX_TOP_K
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_MODEL_PATH
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_PROMPT
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_RANDOM_SEED
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_TEMPERATURE
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_TOP_K
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_TOP_P
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_VISION_ADAPTER
import com.micrantha.amaryllis.AmaryllisModule.Companion.PARAM_VISION_ENCODER

class Amaryllis {

  private var llmInference: LlmInference? = null
  private var session: LlmInferenceSession? = null

  fun init(context: Context, config: ReadableMap) {
    val taskOptions = LlmInference.LlmInferenceOptions.builder()
      .setModelPath(config.getString(PARAM_MODEL_PATH))
      .setMaxTopK(config.getInt(PARAM_MAX_TOP_K))
      .setMaxTokens(config.getInt(PARAM_MAX_TOKENS))
      .setMaxNumImages(config.getInt(PARAM_MAX_NUM_IMAGES))
      .setVisionModelOptions(
        VisionModelOptions.builder().apply {
          config.getString(PARAM_VISION_ADAPTER)?.let {
            setAdapterPath(it)
          }
          config.getString(PARAM_VISION_ENCODER)?.let {
            setEncoderPath(it)
          }
        }.build()
      )
      .build()

    Log.d(NAME, "initializing llm inference")

    this.llmInference = LlmInference.createFromOptions(context, taskOptions)
  }

  fun newSession(params: ReadableMap?) {
    val inference = this.llmInference ?: throw NotInitializedException()

    val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()

    params?.getInt(PARAM_TOP_K)?.let { sessionOptions.setTopK(it) }
    params?.getDouble(PARAM_TOP_P)?.let { sessionOptions.setTopP(it.toFloat()) }
    params?.getDouble(PARAM_TEMPERATURE)?.let { sessionOptions.setTemperature(it.toFloat()) }
    params?.getInt(PARAM_RANDOM_SEED)?.let { sessionOptions.setRandomSeed(it) }
    params?.getString(PARAM_LORA_PATH)?.let { sessionOptions.setLoraPath(it) }
    params?.getBoolean(PARAM_ENABLE_VISION)?.let {
      sessionOptions.setGraphOptions(
        GraphOptions.builder()
          .setEnableVisionModality(it)
          .build()
      )
    }

    Log.d(NAME, "starting new session")

    this.session = LlmInferenceSession.createFromOptions(
      inference,
      sessionOptions.build()
    )
  }

  fun generate(params: ReadableMap) {
    val llm = llmInference ?: throw NotInitializedException()

    val prompt = params.validateAndGetPrompt()

    val result = if (session == null) {
      params.validateNoSession()
      llm.generateResponse(prompt)
    } else {
      this.session?.updateQueryFromParams(params)
      this.session?.generateResponse()
    }
  }

  fun generateAsync(params: ReadableMap, listener: ProgressListener<String>) {
    val llm = llmInference ?: throw NotInitializedException()

    val prompt = params.validateAndGetPrompt()

    if (session == null) {
      params.validateNoSession()
      llm.generateResponseAsync(prompt, listener)
    } else {
      this.session?.updateQueryFromParams(params)
      this.session?.generateResponseAsync(listener)
    }
  }

  fun close() {
    session?.close()
    llmInference?.close()
    session = null
    llmInference = null
  }

  fun cancelAsync() {
    session?.cancelGenerateResponseAsync()
  }

  private fun LlmInferenceSession.updateQueryFromParams(params: ReadableMap): LlmInferenceSession {
    addQueryChunk(params.getString(PARAM_PROMPT) ?: "")
    params.getArray(PARAM_IMAGES)?.run {
      preprocessImages(this).forEach {
        addImage(it)
      }
    }
    return this
  }

  private fun ReadableMap.validateNoSession() {
    if (getArray(PARAM_IMAGES) != null) {
      throw SessionRequiredException()
    }
  }

  private fun ReadableMap.validateAndGetPrompt(): String {
    return getString(PARAM_PROMPT) ?: throw IllegalArgumentException("prompt is required")
  }

  inner class NotInitializedException : Exception()
  inner class SessionRequiredException : Exception()
}
