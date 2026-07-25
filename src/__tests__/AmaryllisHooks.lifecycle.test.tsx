import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { LLMProvider } from '../AmaryllisContext';
import {
  useContextInferenceAsync,
  useInferenceAsync,
} from '../AmaryllisHooks';
import { GenerationInProgressError } from '../Errors';
import type {
  LlmAsyncLifecycleEvent,
  LlmCallbacks,
  LlmEngine,
  LlmEngineConfig,
} from '../Types';
import type { ContextEngine } from '../ContextTypes';

const config: LlmEngineConfig = { modelPath: 'model.task' };

const createPipe = () => {
  const callbacks: LlmCallbacks[] = [];
  const lifecycleListeners = new Set<
    (event: LlmAsyncLifecycleEvent) => void
  >();
  const cancelAsync = jest.fn(() => {
    lifecycleListeners.forEach((listener) => listener({ type: 'cancelled' }));
  });
  const close = jest.fn(() => {
    lifecycleListeners.forEach((listener) => listener({ type: 'closed' }));
  });
  const pipe: LlmEngine = {
    init: jest.fn(() => Promise.resolve()),
    newSession: jest.fn(() => Promise.resolve()),
    generate: jest.fn(() => Promise.resolve('result')),
    generateAsync: jest.fn(async (_params, nextCallbacks) => {
      callbacks.push(nextCallbacks ?? {});
    }),
    close,
    cancelAsync,
    subscribeAsyncLifecycle: (listener) => {
      lifecycleListeners.add(listener);
      return () => lifecycleListeners.delete(listener);
    },
  };

  return { callbacks, pipe };
};

const createWrapper = (pipe: LlmEngine) => {
  return ({ children }: { children: React.ReactNode }) => (
    <LLMProvider config={config} llmPipe={pipe}>
      {children}
    </LLMProvider>
  );
};

const createContextEngine = (
  overrides: Partial<ContextEngine> = {}
): ContextEngine => ({
  add: jest.fn(),
  search: jest.fn(async () => []),
  setPolicy: jest.fn(),
  compact: jest.fn(),
  formatRequest: jest.fn(({ request }) => request),
  deriveQuery: jest.fn((prompt: string) => ({ text: prompt, limit: 6 })),
  ...overrides,
});

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe('useInferenceAsync lifecycle', () => {
  it('resets accumulated output across sequential generations', async () => {
    const { callbacks, pipe } = createPipe();
    const results: Array<{ text: string; isFinal: boolean }> = [];
    const onComplete = jest.fn();
    const { result } = renderHook(
      () =>
        useInferenceAsync({
          onResult: (text, isFinal) => results.push({ text, isFinal }),
          onComplete,
        }),
      { wrapper: createWrapper(pipe) }
    );

    await act(async () => {
      await result.current({ prompt: 'first' });
      callbacks[0]?.onEvent?.({ type: 'partial', text: 'a' });
      callbacks[0]?.onEvent?.({ type: 'final', text: 'b' });
    });

    await act(async () => {
      await result.current({ prompt: 'second' });
      callbacks[1]?.onEvent?.({ type: 'partial', text: 'x' });
      callbacks[1]?.onEvent?.({ type: 'final', text: 'y' });
    });

    expect(results).toEqual([
      { text: 'a', isFinal: false },
      { text: 'ab', isFinal: true },
      { text: 'x', isFinal: false },
      { text: 'xy', isFinal: true },
    ]);
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(pipe.generateAsync).toHaveBeenCalledTimes(2);
  });

  it('rejects an overlapping generation without replacing the active stream', async () => {
    const { callbacks, pipe } = createPipe();
    const onError = jest.fn();
    const { result } = renderHook(() => useInferenceAsync({ onError }), {
      wrapper: createWrapper(pipe),
    });

    let cancelFirst: (() => void) | undefined;
    await act(async () => {
      cancelFirst = await result.current({ prompt: 'first' });
      await result.current({ prompt: 'second' });
    });

    expect(pipe.generateAsync).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(GenerationInProgressError));

    act(() => {
      callbacks[0]?.onEvent?.({ type: 'partial', text: 'still-first' });
    });
    expect(onError).toHaveBeenCalledTimes(1);

    act(() => {
      cancelFirst?.();
    });
    expect(pipe.cancelAsync).toHaveBeenCalledTimes(1);
  });

  it('settles external controller cancellation and permits another request', async () => {
    const { pipe } = createPipe();
    const onComplete = jest.fn();
    const { result } = renderHook(
      () => useInferenceAsync({ onComplete }),
      { wrapper: createWrapper(pipe) }
    );

    await act(async () => {
      await result.current({ prompt: 'first' });
    });

    act(() => {
      pipe.cancelAsync();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current({ prompt: 'second' });
    });
    expect(pipe.generateAsync).toHaveBeenCalledTimes(2);
  });

  it('settles exactly once when generation startup fails', async () => {
    const error = new Error('startup failed');
    const { pipe } = createPipe();
    pipe.generateAsync = jest.fn(() => Promise.reject(error));
    const onError = jest.fn();
    const onComplete = jest.fn();
    const { result } = renderHook(
      () => useInferenceAsync({ onError, onComplete }),
      { wrapper: createWrapper(pipe) }
    );

    let cancel: (() => void) | undefined;
    await act(async () => {
      cancel = await result.current({ prompt: 'test' });
    });

    act(() => {
      cancel?.();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(pipe.cancelAsync).not.toHaveBeenCalled();
  });

  it('cancels the active generation on unmount without firing completion', async () => {
    const { pipe } = createPipe();
    const onComplete = jest.fn();
    const { result, unmount } = renderHook(
      () => useInferenceAsync({ onComplete }),
      { wrapper: createWrapper(pipe) }
    );

    await act(async () => {
      await result.current({ prompt: 'test' });
    });

    unmount();

    expect(pipe.cancelAsync).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('useContextInferenceAsync lifecycle', () => {
  it('does not start inference when unmounted during context retrieval', async () => {
    const deferredSearch = createDeferred<never[]>();
    const contextEngine = createContextEngine({
      search: jest.fn(() => deferredSearch.promise),
    });
    const { pipe } = createPipe();
    const { result, unmount } = renderHook(
      () => useContextInferenceAsync({ contextEngine }),
      { wrapper: createWrapper(pipe) }
    );

    let pendingGeneration: Promise<() => void> | undefined;
    act(() => {
      pendingGeneration = result.current({ prompt: 'first' });
    });
    unmount();

    await act(async () => {
      deferredSearch.resolve([]);
      await pendingGeneration;
    });

    expect(pipe.generateAsync).not.toHaveBeenCalled();
  });

  it('rejects concurrent context retrieval before results can reorder', async () => {
    const deferredSearch = createDeferred<never[]>();
    const contextEngine = createContextEngine({
      search: jest.fn(() => deferredSearch.promise),
    });
    const { callbacks, pipe } = createPipe();
    const onError = jest.fn();
    const { result } = renderHook(
      () => useContextInferenceAsync({ contextEngine, onError }),
      { wrapper: createWrapper(pipe) }
    );

    let firstGeneration: Promise<() => void> | undefined;
    act(() => {
      firstGeneration = result.current({ prompt: 'first' });
    });

    await act(async () => {
      await result.current({ prompt: 'second' });
    });

    expect(onError).toHaveBeenCalledWith(expect.any(GenerationInProgressError));
    expect(contextEngine.search).toHaveBeenCalledTimes(1);
    expect(pipe.generateAsync).not.toHaveBeenCalled();

    await act(async () => {
      deferredSearch.resolve([]);
      await firstGeneration;
      callbacks[0]?.onEvent?.({ type: 'final', text: 'done' });
    });

    expect(pipe.generateAsync).toHaveBeenCalledTimes(1);
  });
});
