package com.micrantha.amaryllis

internal enum class NativeRequestState {
  GENERATING,
  CANCELLING,
}

internal class NativeRequestTracker {
  private var activeRequestId: String? = null
  private var state: NativeRequestState? = null

  @Synchronized
  fun tryStart(requestId: String): Boolean {
    if (activeRequestId != null) {
      return false
    }
    activeRequestId = requestId
    state = NativeRequestState.GENERATING
    return true
  }

  @Synchronized
  fun owns(requestId: String): Boolean = activeRequestId == requestId

  @Synchronized
  fun isCancelling(requestId: String): Boolean =
    activeRequestId == requestId && state == NativeRequestState.CANCELLING

  @Synchronized
  fun requestCancellation(requestId: String): Boolean {
    if (activeRequestId != requestId || state != NativeRequestState.GENERATING) {
      return false
    }
    state = NativeRequestState.CANCELLING
    return true
  }

  @Synchronized
  fun restoreGenerating(requestId: String): Boolean {
    if (activeRequestId != requestId || state != NativeRequestState.CANCELLING) {
      return false
    }
    state = NativeRequestState.GENERATING
    return true
  }

  @Synchronized
  fun settle(requestId: String): NativeRequestState? {
    if (activeRequestId != requestId) {
      return null
    }
    val settledState = state
    activeRequestId = null
    state = null
    return settledState
  }

  @Synchronized
  fun clearAll() {
    activeRequestId = null
    state = null
  }
}
