import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { LLMProvider } from '../AmaryllisContext';
import { useInferenceAsync } from '../AmaryllisHooks';
import { GenerationInProgressError } from '../Amaryllis';
import type { LlmCallbacks, LlmEngine, LlmEngineConfig } from '../Types';

const config: LlmEngineConfig = { modelPath: 'model.task' };

const createPipe = () => {
  const callbacks: LlmCallbacks[] = [];
  const pipe: LlmEngine = {
    init: jest.fn(() => Promise.resolve()),
    newSession: jest.fn(() => Promise.resolve()),
    generate: jest.fn(() => Promise.resolve('result')),
    generateAsync: jest.fn(async (_params, nextCallbacks) => {
      callbacks.push(nextCallbacks ?? {});
    }),
    close: jest.fn(),
    cancelAsync: jest.fn(),
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
    const { result } = renderHook(
      () => useInferenceAsync({ onError }),
      { wrapper: createWrapper(pipe) }
    );

    let cancelFirst: (() => void) | undefined;
    await act(async () => {
      cancelFirst = await result.current({ prompt: 'first' });
      await result.current({ prompt: 'second' });
    });

    expect(pipe.generateAsync).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(GenerationInProgressError)
    );

    act(() => {
      callbacks[0]?.onEvent?.({ type: 'partial', text: 'still-first' });
    });
    expect(onError).toHaveBeenCalledTimes(1);

    act(() => {
      cancelFirst?.();
    });
    expect(pipe.cancelAsync).toHaveBeenCalledTimes(1);
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
