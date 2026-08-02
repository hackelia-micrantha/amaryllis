package com.micrantha.amaryllis

internal class NativeRequestTracker {
  private var activeRequestId: String? = null

  @Synchronized
  fun tryStart(requestId: String): Boolean {
    if (activeRequestId != null) {
      return false
    }
    activeRequestId = requestId
    return true
  }

  @Synchronized
  fun owns(requestId: String): Boolean = activeRequestId == requestId

  @Synchronized
  fun clear(requestId: String): Boolean {
    if (activeRequestId != requestId) {
      return false
    }
    activeRequestId = null
    return true
  }

  @Synchronized
  fun clearAll() {
    activeRequestId = null
  }
}
