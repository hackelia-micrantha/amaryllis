import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { LLMProvider } from '../AmaryllisContext';
import { useInferenceAsync } from '../AmaryllisHooks';
import { GenerationInProgressError } from '../Errors';
import type {
  LlmAsyncLifecycleEvent,
  LlmCallbacks,
  LlmEngine,
  LlmEngineConfig,
} from '../Types';

const config: LlmEngineConfig = { modelPath: 'model.task' };

const createLifecyclePipe = () => {
  const callbacks: LlmCallbacks[] = [];
  const lifecycleListeners = new Set<
    (event: LlmAsyncLifecycleEvent) => void
  >();
  const pipe: LlmEngine = {
    init: jest.fn(() => Promise.resolve()),
    newSession: jest.fn(() => Promise.resolve()),
    generate: jest.fn(() => Promise.resolve('result')),
    generateAsync: jest.fn(async (_params, nextCallbacks) => {
      callbacks.push(nextCallbacks ?? {});
    }),
    close: jest.fn(),
    cancelAsync: jest.fn(),
    subscribeAsyncLifecycle: (listener) => {
      lifecycleListeners.add(listener);
      return () => lifecycleListeners.delete(listener);
    },
  };

  const emitLifecycle = (event: LlmAsyncLifecycleEvent) => {
    lifecycleListeners.forEach((listener) => listener(event));
  };

  return { callbacks, emitLifecycle, pipe };
};

const createWrapper = (pipe: LlmEngine) => {
  return ({ children }: { children: React.ReactNode }) => (
    <LLMProvider config={config} llmPipe={pipe}>
      {children}
    </LLMProvider>
  );
};

describe('useInferenceAsync terminal cancellation', () => {
  it('waits for lifecycle cancellation before completing or accepting another request', async () => {
    const { emitLifecycle, pipe } = createLifecyclePipe();
    const onComplete = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(
      () => useInferenceAsync({ onComplete, onError }),
      { wrapper: createWrapper(pipe) }
    );

    let cancel: (() => void) | undefined;
    await act(async () => {
      cancel = await result.current({ prompt: 'first' });
    });

    act(() => {
      cancel?.();
    });

    expect(pipe.cancelAsync).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      await result.current({ prompt: 'blocked' });
    });
    expect(onError).toHaveBeenCalledWith(expect.any(GenerationInProgressError));
    expect(pipe.generateAsync).toHaveBeenCalledTimes(1);

    act(() => {
      emitLifecycle({ type: 'cancelled' });
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current({ prompt: 'second' });
    });
    expect(pipe.generateAsync).toHaveBeenCalledTimes(2);
  });

  it('keeps the generation active when a cancellation request throws', async () => {
    const cancelError = new Error('cancel failed');
    const { callbacks, pipe } = createLifecyclePipe();
    (pipe.cancelAsync as jest.Mock).mockImplementationOnce(() => {
      throw cancelError;
    });
    const onComplete = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(
      () => useInferenceAsync({ onComplete, onError }),
      { wrapper: createWrapper(pipe) }
    );

    let cancel: (() => void) | undefined;
    await act(async () => {
      cancel = await result.current({ prompt: 'first' });
    });

    act(() => {
      cancel?.();
    });

    expect(onError).toHaveBeenCalledWith(cancelError);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      callbacks[0]?.onEvent?.({ type: 'final', text: 'done' });
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
