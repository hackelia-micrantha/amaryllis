package com.micrantha.amaryllis

import android.content.Context
import android.graphics.BitmapFactory
import android.util.Log
import androidx.core.graphics.scale
import androidx.core.net.toFile
import androidx.core.net.toUri
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
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
import java.io.File
import java.io.FileOutputStream
import java.io.IOException


class Amaryllis {

    private var llmInference: LlmInference? = null
    private var session: LlmInferenceSession? = null

    fun init(context: Context, config: ReadableMap) {
        val modelPath = config.getString(PARAM_MODEL_PATH) ?: throw InvalidModelPathException()

        val taskOptions = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(modelPath).apply {
                if (config.hasKey(PARAM_MAX_TOP_K))
                  setMaxTopK(config.getInt(PARAM_MAX_TOP_K))
                if (config.hasKey(PARAM_MAX_TOKENS))
                  setMaxTokens(config.getInt(PARAM_MAX_TOKENS))
                if (config.hasKey(PARAM_MAX_NUM_IMAGES))
                  setMaxNumImages(config.getInt(PARAM_MAX_NUM_IMAGES))
            }
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

        if (params?.hasKey(PARAM_TOP_K) == true)
            sessionOptions.setTopK(params.getInt(PARAM_TOP_K))
        if (params?.hasKey(PARAM_TOP_P) == true)
            sessionOptions.setTopP(params.getDouble(PARAM_TOP_P).toFloat())
        if (params?.hasKey(PARAM_TEMPERATURE) == true)
            sessionOptions.setTemperature(params.getDouble(PARAM_TEMPERATURE).toFloat())
        if (params?.hasKey(PARAM_RANDOM_SEED) == true)
            sessionOptions.setRandomSeed(params.getInt(PARAM_RANDOM_SEED))
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

        if (session == null) {
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

    /**
     * Loads and preprocesses an image for the LLM session.
     * - Resizes to targetWidth x targetHeight (default 512x512)
     * - Converts to MPImage for inference
     */
    internal fun preprocessImage(
        uri: String,
        targetWidth: Int = 512,
        targetHeight: Int = 512
    ): MPImage? {
        val file = uri.toUri().toFile()

        if (!file.exists()) return null

        // Decode bitmap
        val bitmap = BitmapFactory.decodeFile(file.absolutePath)
            ?: return null

        // Resize bitmap
        val resized = bitmap.scale(targetWidth, targetHeight)

        // Convert to MPImage
        return BitmapImageBuilder(resized).build()
    }

    internal fun preprocessImages(
        uris: ReadableArray,
        targetWidth: Int = 512,
        targetHeight: Int = 512
    ) = uris.toArrayList().mapNotNull {
        val uri = it as? String ?: return@mapNotNull null
        preprocessImage(uri, targetWidth, targetHeight)
    }

    inner class NotInitializedException : Exception()
    inner class SessionRequiredException : Exception()
    inner class InvalidModelPathException : Exception()
}
