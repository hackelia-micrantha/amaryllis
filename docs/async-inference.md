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

`await generate(...)` waits for validation and native startup. It does **not** wait for the model to finish. Use `onComplete`, the final `onResult(..., true)` callback, or an application wrapper to await terminal completion.

The returned function cancels only the generation started by that call. Calling it more than once, or after settlement, is a no-op.

## Single-flight contract

One synchronous or asynchronous generation may own a native module at a time. This applies across `LlmPipe` instances that share the same native module.

An overlapping call:

- is rejected immediately;
- reports `GenerationInProgressError` with code `GENERATION_IN_PROGRESS`;
- is not queued;
- does not cancel or otherwise disturb the active generation.

At the low-level `LlmPipe` API, the overlapping call rejects with `GenerationInProgressError`. `useInferenceAsync` reports the same error through `onError` and returns a no-op cancellation function for the rejected attempt. It does not invoke `onComplete` for that rejected attempt; the already-active generation continues with its original callbacks.

Starting a generation while the native engine is closing is rejected by the same contract.

Sequential calls are supported after the prior operation reaches a terminal state and releases ownership.

## Request isolation

Every accepted asynchronous generation receives an internal request ID. Android and iOS include that ID in structured partial, final, and error events. JavaScript ignores events that do not match the active request.

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
- listeners are removed;
- native and JavaScript ownership are released;
- `onComplete` is invoked once;
- the hook can start a later generation.

### Generation error

- the matching request receives `onError`;
- listeners and ownership are released;
- `onComplete` follows as a terminal lifecycle notification;
- late events are ignored.

### Explicit cancellation

Calling the cancellation function returned by `generate(...)`:

- targets only that generation;
- releases listeners and ownership;
- invokes `onComplete` by default;
- does not emit a final result;
- is idempotent.

`onComplete` means that the operation ended; it does not mean that generation succeeded. Applications that distinguish success, error, and cancellation should track that state explicitly.

### Component unmount

Unmount cancels only the generation owned by that hook instance. Cleanup is silent: it does not invoke `onComplete` after the component has unmounted.

### Engine close

`close()` owns the engine lifecycle. It may cancel active work, removes listeners, and releases native resources. Generation startup and close are serialized on Android and iOS so a new request cannot enter MediaPipe during teardown.

## Sequential generations

Do not use only `await generate(...)` as the sequencing boundary because that promise resolves after startup. Wait for terminal completion before starting the next request.

See [Sequential asynchronous inference](examples/sequential-async-inference.md) for a complete React example that converts the callback lifecycle into an awaitable application helper and runs two requests from the same mounted hook.

## Resource and security guidance

- Bound token counts, image counts, and image sizes.
- Cancel work that is no longer visible or relevant.
- Treat model output as untrusted input.
- Do not log prompts, generated output, model paths, or image paths unless the application has an explicit safe logging policy.
- Use `close()` when the application owns the complete engine lifecycle, not as a substitute for request cancellation.
