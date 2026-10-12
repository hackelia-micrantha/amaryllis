import React from 'react';
import { act, render } from '@testing-library/react-native';
import { LLMProvider, useLLMContext } from '../AmaryllisContext';
import { useInferenceAsync } from '../AmaryllisHooks';
import { newLlmPipe } from '../NativePipe';
import type { LLMContextValue, LlmEngine, LlmEngineConfig } from '../Types';

const configA: LlmEngineConfig = { modelPath: 'a.task' };
const configB: LlmEngineConfig = { modelPath: 'b.task' };

const deferred = () => {
  let resolve: () => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createPipe = (
  init: (config: LlmEngineConfig) => Promise<void> = async () => {}
): LlmEngine => ({
  init: jest.fn(init),
  newSession: jest.fn(async () => {}),
  generate: jest.fn(async () => 'result'),
  generateAsync: jest.fn(async () => {}),
  cancelAsync: jest.fn(),
  close: jest.fn(),
});

describe('LLMProvider lifecycle authority', () => {
  let observed: LLMContextValue | undefined;
  const Probe = () => {
    observed = useLLMContext();
    return null;
  };
  const current = () => {
    if (!observed) throw new Error('Context not observed');
    return observed;
  };

  beforeEach(() => {
    observed = undefined;
  });

  it('does not publish a controller until initialization succeeds', async () => {
    const pending = deferred();
    const engine = createPipe(() => pending.promise);
    const { unmount } = render(
      <LLMProvider config={configA} llmPipe={engine}>
        <Probe />
      </LLMProvider>
    );

    expect(current().controller).toBeNull();
    expect(current().isReady).toBe(false);
    expect(current().error).toBeUndefined();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(current().controller).toBe(engine);
    expect(current().isReady).toBe(true);
    expect(current().error).toBeUndefined();

    unmount();
    expect(engine.close).toHaveBeenCalledTimes(1);
  });

  it('withdraws an injected controller during reconfiguration, then reuses it', async () => {
    const next = deferred();
    const engine = createPipe();
    (engine.init as jest.Mock)
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(() => next.promise);

    const { rerender, unmount } = render(
      <LLMProvider config={configA} llmPipe={engine}>
        <Probe />
      </LLMProvider>
    );
    await act(async () => {});
    expect(current().controller).toBe(engine);

    rerender(
      <LLMProvider config={configB} llmPipe={engine}>
        <Probe />
      </LLMProvider>
    );
    expect(current().controller).toBeNull();
    expect(current().isReady).toBe(false);
    expect(engine.close).toHaveBeenCalledTimes(1);
    expect(engine.init).toHaveBeenNthCalledWith(2, configB);

    await act(async () => {
      next.resolve();
      await next.promise;
    });
    expect(current().controller).toBe(engine);
    expect(current().isReady).toBe(true);

    unmount();
    expect(engine.close).toHaveBeenCalledTimes(2);
  });

  it('does not start reinitialization before a stale same-engine init settles', async () => {
    const first = deferred();
    const second = deferred();
    const engine = createPipe();
    (engine.init as jest.Mock)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { rerender, unmount } = render(
      <LLMProvider config={configA} llmPipe={engine}>
        <Probe />
      </LLMProvider>
    );
    expect(engine.init).toHaveBeenCalledTimes(1);

    rerender(
      <LLMProvider config={configB} llmPipe={engine}>
        <Probe />
      </LLMProvider>
    );
    expect(current().controller).toBeNull();
    expect(engine.init).toHaveBeenCalledTimes(1);
    expect(engine.close).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(engine.close).toHaveBeenCalledTimes(2);
    expect(engine.init).toHaveBeenCalledTimes(2);
    expect(engine.init).toHaveBeenNthCalledWith(2, configB);
    expect(current().controller).toBeNull();

    await act(async () => {
      second.resolve();
      await second.promise;
    });
    expect(current().controller).toBe(engine);
    expect(current().isReady).toBe(true);
    unmount();
    expect(engine.close).toHaveBeenCalledTimes(3);
  });

  it('prevents a stale engine completion from becoming authoritative', async () => {
    const first = deferred();
    const second = deferred();
    const engineA = createPipe(() => first.promise);
    const engineB = createPipe(() => second.promise);
    const { rerender, unmount } = render(
      <LLMProvider config={configA} llmPipe={engineA}>
        <Probe />
      </LLMProvider>
    );

    rerender(
      <LLMProvider config={configB} llmPipe={engineB}>
        <Probe />
      </LLMProvider>
    );
    expect(engineA.close).toHaveBeenCalledTimes(1);
    expect(current().controller).toBeNull();

    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(current().controller).toBeNull();
    expect(current().isReady).toBe(false);
    expect(engineA.close).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve();
      await second.promise;
    });
    expect(current().controller).toBe(engineB);
    expect(current().isReady).toBe(true);
    unmount();
    expect(engineB.close).toHaveBeenCalledTimes(1);
  });

  it('closes a failed candidate and clears its error on a successful recovery', async () => {
    const first = deferred();
    const engineA = createPipe(() => first.promise);
    const engineB = createPipe();
    const { rerender, unmount } = render(
      <LLMProvider config={configA} llmPipe={engineA}>
        <Probe />
      </LLMProvider>
    );

    await act(async () => {
      first.reject(new Error('init failed'));
      try {
        await first.promise;
      } catch {
        // Failure is consumed by the provider.
      }
    });
    expect(current().controller).toBeNull();
    expect(current().isReady).toBe(false);
    expect(current().error?.message).toBe('init failed');
    expect(engineA.close).toHaveBeenCalledTimes(1);

    rerender(
      <LLMProvider config={configB} llmPipe={engineB}>
        <Probe />
      </LLMProvider>
    );
    expect(current().error).toBeUndefined();
    await act(async () => {});
    expect(current().controller).toBe(engineB);
    expect(current().error).toBeUndefined();

    unmount();
    expect(engineA.close).toHaveBeenCalledTimes(1);
    expect(engineB.close).toHaveBeenCalledTimes(1);
  });

  it('closes pending initialization on unmount without publishing a late result', async () => {
    const pending = deferred();
    const engine = createPipe(() => pending.promise);
    const { unmount } = render(
      <LLMProvider config={configA} llmPipe={engine}>
        <Probe />
      </LLMProvider>
    );
    expect(current().controller).toBeNull();
    unmount();
    expect(engine.close).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(engine.close).toHaveBeenCalledTimes(2);
  });

  it('keeps inference hooks from invoking an initializing engine', async () => {
    const pending = deferred();
    const engine = createPipe(() => pending.promise);
    const onError = jest.fn();
    const InferenceProbe = () => {
      const generate = useInferenceAsync({ onError });
      React.useEffect(() => {
        void generate({ prompt: 'before init' });
      }, [generate]);
      return null;
    };

    const { unmount } = render(
      <LLMProvider config={configA} llmPipe={engine}>
        <InferenceProbe />
      </LLMProvider>
    );
    await act(async () => {});
    expect(engine.generateAsync).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Controller not initialized' })
    );
    unmount();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
  });

  it('reports engine construction failures without updating state during render', async () => {
    (newLlmPipe as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native unavailable');
    });

    const { unmount } = render(
      <LLMProvider config={configA}>
        <Probe />
      </LLMProvider>
    );
    await act(async () => {});
    expect(current().controller).toBeNull();
    expect(current().isReady).toBe(false);
    expect(current().error?.message).toBe('native unavailable');
    unmount();
  });
});
