package com.micrantha.amaryllis

import android.graphics.BitmapFactory
import androidx.core.graphics.scale
import com.facebook.react.bridge.ReadableArray
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import java.io.File

/**
 * Loads and preprocesses an image for the LLM session.
 * - Resizes to targetWidth x targetHeight (default 512x512)
 * - Converts to MPImage for inference
 */
internal fun preprocessImage(uri: String, targetWidth: Int = 512, targetHeight: Int = 512): MPImage? {
    val file = File(uri)
    if (!file.exists()) return null

    // Decode bitmap
    val bitmap = BitmapFactory.decodeFile(uri)
        ?: return null

    // Resize bitmap
    val resized = bitmap.scale(targetWidth, targetHeight)

    // Convert to MPImage
    return BitmapImageBuilder(resized).build()
}

internal fun preprocessImages(uris: ReadableArray, targetWidth: Int = 512, targetHeight: Int = 512) = uris.toArrayList().mapNotNull {
    val uri = it as? String ?: return@mapNotNull null
    preprocessImage(uri, targetWidth, targetHeight)
}
