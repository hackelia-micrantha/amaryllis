package com.micrantha.amaryllis

import com.google.mediapipe.tasks.genai.llminference.ProgressListener
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class AsyncProgressDeliveryTest {
  @Test
  fun successfulDeliveryReturnsNoError() {
    var observedText: String? = null
    var observedDone = false
    val listener = ProgressListener<String> { text, done ->
      observedText = text
      observedDone = done
    }

    val error = deliverAsyncProgress(listener, "final", true)

    assertNull(error)
    assertEquals("final", observedText)
    assertTrue(observedDone)
  }

  @Test
  fun listenerFailureIsReturnedInsteadOfEscapingMediaPipeCallback() {
    val expected = IllegalStateException("delivery failed")
    val listener = ProgressListener<String> { _, _ -> throw expected }

    val error = deliverAsyncProgress(listener, "final", true)

    assertSame(expected, error)
  }
}
