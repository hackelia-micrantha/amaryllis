# Asynchronous inference lifecycle

Amaryllis asynchronous inference is request-scoped and single-flight. This document defines the current `0.1.x` behavior of `useInferenceAsync`, `LlmPipe.generateAsync`, native request correlation, cancellation, and streamed output.

## Recommended entry point

Use `useInferenceAsync` for React components. It creates a fresh stream and output buffer for every accepted generation while preserving one hook instance across sequential calls.

```tsx
const generate = useInferenceAsync({
  onResult: (text, isFinal) => {
    setOutput(text);
    if (isFinal) {
      setStatus('complete');
    }
  },
  onError: handleError,
  onComplete: handleComplete,
});

const cancel = await generate({ prompt, images });
```

`await generate(...)` waits for validation and native startup. It does **not** wait for the model to finish. The final `onResult(..., true)` callback delivers the complete output, while `onComplete` is the safe boundary for immediately starting another request. Do not start the next request synchronously from inside the final `onResult` callback; hook ownership is released immediately after that callback returns.

The returned function requests cancellation only for the generation started by that call. Calling it more than once, or after settlement, is a no-op. Cancellation is not terminal until the native request reaches a terminal state.

## Single-flight contract

One synchronous or asynchronous generation may own a native module at a time. This applies across `LlmPipe` instances that share the same native module.

An overlapping call:

- is rejected immediately;
- reports `GenerationInProgressError` with code `GENERATION_IN_PROGRESS`;
- is not queued;
- does not cancel or otherwise disturb the active generation.

At the low-level `LlmPipe` API, the overlapping call rejects with `GenerationInProgressError`. `useInferenceAsync` reports the same error through `onError` and returns a no-op cancellation function for the rejected attempt. It does not invoke `onComplete` for that rejected attempt; the already-active generation continues with its original callbacks.

Starting a generation while the native engine is closing or while a prior request is cancelling is rejected by the same contract.

Sequential calls are supported after the prior operation reaches a terminal state and releases ownership.

## Request isolation

Every accepted asynchronous generation receives an internal request ID. Android and iOS include that ID in structured partial, final, error, and cancellation events. JavaScript ignores events that do not match the active request.

This prevents:

- a new generation receiving stale output from an earlier request;
- completion or error from one request settling another;
- cancellation of one request cancelling an unrelated request;
- a late native callback clearing ownership of a newer request.

Custom engines remain single-flight through `LlmPipe`. They should use the structured event contract when they bridge through the built-in native event emitter.

## Stream semantics

Amaryllis exposes two stream layers with different text semantics.

| Layer | Callback | Text contract |
| --- | --- | --- |
| React hook | `useInferenceAsync({ onResult })` | `text` is the complete accumulated output produced so far. Replace displayed text; do not append it. `isFinal: true` contains the complete final output. |
| Low-level engine | `LlmCallbacks.onEvent` partial event | `event.text` is the next delta from the native stream. Accumulate it when using this interface directly. |
| Low-level engine | `LlmCallbacks.onEvent` final event | `event.text` is the terminal delta and may be empty. It marks completion and should be accumulated once. |
| Legacy callback | `onPartialResult` | Incremental delta. Deprecated in favor of `onEvent`. |
| Legacy callback | `onFinalResult` | Complete accumulated final output. Deprecated in favor of `onEvent` or the hook adapter. |

The hook adapter accumulates low-level deltas before invoking `onResult`. Therefore this is correct:

```tsx
onResult: (text) => setOutput(text)
```

This duplicates output and is incorrect:

```tsx
onResult: (text) => setOutput((current) => current + text)
```

A configured protocol sanitizes the accumulated hook output before `onResult` is invoked.

## Terminal behavior

### Successful completion

- the final result is delivered exactly once;
- after the final callback returns, listeners are removed and ownership is released;
- `onComplete` is invoked once;
- the hook can start a later generation from `onComplete` or afterward.

### Generation error

- the matching request receives `onError`;
- listeners and ownership are released;
- `onComplete` follows as a terminal lifecycle notification;
- late events are ignored.

### Explicit cancellation

Calling the cancellation function returned by `generate(...)`:

- targets only that generation;
- transitions the request from generating to cancelling;
- asks native inference to cancel but does **not** treat the request as terminal yet;
- suppresses later partial/final/error delivery for the cancelling request;
- retains listeners and native ownership, so overlapping work remains rejected;
- releases ownership only after native emits request-scoped `onCancelled { requestId }`;
- invokes `onComplete` once after that terminal cancellation event;
- does not emit a final result;
- is idempotent while cancellation is pending.

If the synchronous native cancellation request itself throws, the request returns to the generating state and remains owned; no false cancellation completion is emitted.

Android MediaPipe 0.10.24 supports physical cancellation on `LlmInferenceSession`. Amaryllis therefore runs asynchronous Android inference through an explicit session even for requests that did not create a persistent session, retaining the active session and future until terminal settlement. On iOS, when the pinned MediaPipe runtime does not expose a cancellation selector, Amaryllis uses cooperative cancellation: output is suppressed, ownership remains held, and the eventual native completion or error is translated into the same request-scoped `onCancelled` terminal event.

`onComplete` means that the operation ended; it does not mean that generation succeeded. Applications that distinguish success, error, and cancellation should track that state explicitly.

### Component unmount

Unmount requests cancellation only for the generation owned by that hook instance. Cleanup is silent: it does not invoke `onComplete` after the component has unmounted. Native ownership is still retained until cancellation reaches a terminal state or the owning engine is closed.

### Engine close

`close()` owns the engine lifecycle. For active asynchronous work it requests cancellation first, closes the native engine, and only after native close returns releases JavaScript ownership and listeners. A failed native close therefore cannot falsely advertise an idle engine. Later request callbacks from a successfully closed engine are ignored.

## Sequential generations

Do not use only `await generate(...)` as the sequencing boundary because that promise resolves after startup. Use `onComplete`, or an application promise resolved by the terminal callbacks, before starting the next request. Avoid directly re-entering `generate` from inside the final `onResult` callback.

See [Sequential asynchronous inference](examples/sequential-async-inference.md) for a complete React example that converts the callback lifecycle into an awaitable application helper and runs two requests from the same mounted hook.

## Resource and security guidance

- Bound token counts, image counts, and image sizes.
- Cancel work that is no longer visible or relevant.
- Treat model output as untrusted input.
- Do not log prompts, generated output, model paths, or image paths unless the application has an explicit safe logging policy.
- Use `close()` when the application owns the complete engine lifecycle, not as a substitute for request cancellation.
