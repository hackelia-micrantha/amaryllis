import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { LLMProvider } from '../AmaryllisContext';
import { useInferenceAsync } from '../AmaryllisHooks';
import type { LlmEngine, LlmEngineConfig } from '../Types';

const config: LlmEngineConfig = { modelPath: 'model.task' };

const createWrapper = (engine: LlmEngine) => {
  return ({ children }: { children: React.ReactNode }) => (
    <LLMProvider config={config} llmPipe={engine}>
      {children}
    </LLMProvider>
  );
};

const createEngine = (
  generateAsync: LlmEngine['generateAsync']
): LlmEngine => ({
  init: jest.fn(() => Promise.resolve()),
  newSession: jest.fn(() => Promise.resolve()),
  generate: jest.fn(() => Promise.resolve('result')),
  generateAsync: jest.fn(generateAsync),
  close: jest.fn(),
  cancelAsync: jest.fn(),
});

describe('useInferenceAsync callback isolation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not let result-handler exceptions reject a custom engine generation', async () => {
    const callbackError = new Error('result observer failed');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onResult = jest.fn(() => {
      throw callbackError;
    });
    const onError = jest.fn();
    const onComplete = jest.fn();
    const engine = createEngine(async (_params, callbacks) => {
      callbacks?.onEvent?.({ type: 'partial', text: 'a' });
      callbacks?.onEvent?.({ type: 'final', text: 'b' });
    });
    const { result } = renderHook(
      () => useInferenceAsync({ onResult, onError, onComplete }),
      { wrapper: createWrapper(engine) }
    );

    await act(async () => {
      await result.current({ prompt: 'first' });
      await result.current({ prompt: 'second' });
    });

    expect(engine.generateAsync).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(4);
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      'Error in onResult callback:',
      callbackError
    );
  });

  it('does not let error-handler exceptions escape a custom engine callback', async () => {
    const generationError = new Error('generation failed');
    const callbackError = new Error('error observer failed');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onError = jest.fn(() => {
      throw callbackError;
    });
    const onComplete = jest.fn();
    const engine = createEngine(async (_params, callbacks) => {
      callbacks?.onEvent?.({ type: 'error', error: generationError });
    });
    const { result } = renderHook(
      () => useInferenceAsync({ onError, onComplete }),
      { wrapper: createWrapper(engine) }
    );

    await act(async () => {
      await result.current({ prompt: 'first' });
      await result.current({ prompt: 'second' });
    });

    expect(engine.generateAsync).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      'Error in onError callback:',
      callbackError
    );
  });
});
