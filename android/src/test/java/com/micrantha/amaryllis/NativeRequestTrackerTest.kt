package com.micrantha.amaryllis

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class NativeRequestTrackerTest {
  @Test
  fun rejectsOverlapAndAllowsRestartAfterCompletion() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertFalse(tracker.tryStart("second"))
    assertEquals(NativeRequestState.GENERATING, tracker.settle("first"))
    assertTrue(tracker.tryStart("second"))
  }

  @Test
  fun cancellationRetainsOwnershipUntilTerminalSettlement() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertFalse(tracker.requestCancellation("other"))
    assertTrue(tracker.requestCancellation("first"))
    assertTrue(tracker.owns("first"))
    assertTrue(tracker.isCancelling("first"))
    assertFalse(tracker.tryStart("second"))
    assertFalse(tracker.requestCancellation("first"))
    assertEquals(NativeRequestState.CANCELLING, tracker.settle("first"))
    assertFalse(tracker.owns("first"))
    assertTrue(tracker.tryStart("second"))
  }

  @Test
  fun failedCancellationCanRestoreGeneratingState() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertTrue(tracker.requestCancellation("first"))
    assertTrue(tracker.restoreGenerating("first"))
    assertFalse(tracker.isCancelling("first"))
    assertTrue(tracker.owns("first"))
    assertEquals(NativeRequestState.GENERATING, tracker.settle("first"))
  }

  @Test
  fun closeClearsActiveRequestAndAllowsImmediateRestart() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertTrue(tracker.requestCancellation("first"))
    tracker.clearAll()
    assertFalse(tracker.owns("first"))
    assertTrue(tracker.tryStart("second"))
  }

  @Test
  fun staleCompletionCannotClearANewerRequest() {
    val tracker = NativeRequestTracker()

    assertTrue(tracker.tryStart("first"))
    assertEquals(NativeRequestState.GENERATING, tracker.settle("first"))
    assertTrue(tracker.tryStart("second"))
    assertNull(tracker.settle("first"))
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
