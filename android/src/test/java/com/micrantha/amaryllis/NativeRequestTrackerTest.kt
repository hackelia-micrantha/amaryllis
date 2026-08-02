package com.micrantha.amaryllis

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NativeRequestTrackerTest {
  @Test
  fun rejectsOverlapAndAllowsRestartAfterCompletion() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertFalse(tracker.tryStart("second"))
    assertTrue(tracker.clear("first"))
    assertTrue(tracker.tryStart("second"))
  }

  @Test
  fun cancellationIsRequestScopedAndLateCallbacksAreIgnored() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertFalse(tracker.clear("other"))
    assertTrue(tracker.owns("first"))
    assertTrue(tracker.clear("first"))
    assertFalse(tracker.owns("first"))
    assertFalse(tracker.clear("first"))
  }

  @Test
  fun closeClearsActiveRequestAndAllowsImmediateRestart() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    tracker.clearAll()
    assertFalse(tracker.owns("first"))
    assertTrue(tracker.tryStart("second"))
  }

  @Test
  fun staleCompletionCannotClearANewerRequest() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertTrue(tracker.clear("first"))
    assertTrue(tracker.tryStart("second"))
    assertFalse(tracker.clear("first"))
    assertTrue(tracker.owns("second"))
  }

  @Test
  fun concurrentStartsHaveExactlyOneWinner() {
    val tracker = NativeRequestTracker()
    val ready = CountDownLatch(2)
    val start = CountDownLatch(1)
    val executor = Executors.newFixedThreadPool(2)

    val results = listOf("first", "second").map { requestId ->
      executor.submit<Boolean> {
        ready.countDown()
        start.await()
        tracker.tryStart(requestId)
      }
    }

    ready.await()
    start.countDown()

    assertTrue(results.count { it.get() } == 1)
    executor.shutdownNow()
  }
}
