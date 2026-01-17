import React from 'react';
import { renderHook, act } from './test-utils';
import {
  useContextInference,
  useContextInferenceAsync,
  useInference,
  useInferenceAsync,
} from '../AmaryllisHooks';
import { mockPipe, config } from './test-utils';
import type { LlmRequestParams } from '../Types';
import { LLMProvider } from '../AmaryllisContext';
import { ContextEngineProvider } from '../ContextEngineContext';
import type { ContextEngine, ContextItem, ContextQuery } from '../ContextTypes';

describe('useInferenceAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call generateAsync and update results', async () => {
    let results: string[] = [];
    let isBusy = false;
    const { result } = renderHook(() =>
      useInferenceAsync({
        onGenerate: () => {
          isBusy = true;
        },
        onResult: (res, isFinal) => {
          results.push(res);
          if (isFinal) isBusy = false;
        },
        onComplete: () => {
          isBusy = false;
        },
      })
    );

    const params: LlmRequestParams = { prompt: 'test' };

    await act(async () => {
      await result.current?.(params);
      // @ts-ignore
      const callback = mockPipe.generateAsync.mock.calls[0][1];
      callback.onEvent({ type: 'partial', text: 'partial' });
      callback.onEvent({ type: 'final', text: 'final' });
    });

    expect(mockPipe.generateAsync).toHaveBeenCalledWith(
      params,
      expect.any(Object)
    );
    expect(results).toEqual(['partial', 'final']);
    expect(isBusy).toBe(false);
  });

  it('should handle cancellation', async () => {
    const { result } = renderHook(() => useInferenceAsync());

    let cancel: () => void;
    await act(async () => {
      cancel = await result.current?.({ prompt: 'test' });
    });

    act(() => {
      if (cancel) {
        cancel();
      }
    });

    expect(mockPipe.cancelAsync).toHaveBeenCalled();
  });

  it('should handle errors from generateAsync', async () => {
    let error: Error | undefined;
    mockPipe.generateAsync = jest.fn(() => {
      return Promise.reject(new Error('generate error'));
    });

    const { result } = renderHook(() =>
      useInferenceAsync({
        onError: (err) => {
          error = err;
        },
      })
    );

    await act(async () => {
      await result.current?.({ prompt: 'test' });
    });

    expect(error?.message).toBe('generate error');
  });
});

describe('useInference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call generate and update results', async () => {
    let results: string[] = [];
    const { result } = renderHook(() =>
      useInference({
        onResult: (res) => {
          results.push(res);
        },
      })
    );

    const params: LlmRequestParams = { prompt: 'test' };

    await act(async () => {
      await result.current?.(params);
    });

    expect(mockPipe.generate).toHaveBeenCalledWith(params);
    expect(results).toEqual(['test response']);
  });

  it('should handle errors from generate', async () => {
    let error: Error | undefined;
    mockPipe.generate = jest.fn(() => {
      return Promise.reject(new Error('generate error'));
    });

    const { result } = renderHook(() =>
      useInference({
        onError: (err) => {
          error = err;
        },
      })
    );

    await act(async () => {
      await result.current?.({ prompt: 'test' });
    });

    expect(error?.message).toBe('generate error');
  });
});

const createWrapper = (engine?: ContextEngine) => {
  return ({ children }: { children: React.ReactNode }) => (
    <LLMProvider config={config} llmPipe={mockPipe}>
      {engine ? (
        <ContextEngineProvider engine={engine}>
          {children}
        </ContextEngineProvider>
      ) : (
        children
      )}
    </LLMProvider>
  );
};

const createContextEngineMock = (
  overrides: Partial<ContextEngine> = {}
): ContextEngine => {
  return {
    add: jest.fn(),
    search: jest.fn(async () => []),
    setPolicy: jest.fn(),
    compact: jest.fn(),
    formatRequest: jest.fn(({ request }) => request),
    deriveQuery: jest.fn(),
    ...overrides,
  };
};

describe('context-aware hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPipe.generate = jest.fn(() => Promise.resolve('test response'));
    mockPipe.generateAsync = jest.fn(() => Promise.resolve());
  });

  it('should prefer context engine prop over provider', async () => {
    const query: ContextQuery = { text: 'hello', limit: 1 };
    const providerEngine = createContextEngineMock();
    const propEngine = createContextEngineMock();

    const { result } = renderHook(
      () => useContextInference({ contextEngine: propEngine, query }),
      { wrapper: createWrapper(providerEngine) }
    );

    await act(async () => {
      await result.current?.({ prompt: 'hello' });
    });

    expect(propEngine.search).toHaveBeenCalledWith(query);
    expect(providerEngine.search).not.toHaveBeenCalled();
  });

  it('should augment prompt when query is provided', async () => {
    const query: ContextQuery = { text: 'hello', limit: 2 };
    const items: ContextItem[] = [
      { id: '1', text: 'saved', createdAt: Date.now() },
    ];
    const engine = createContextEngineMock({
      search: jest.fn(async () => items),
      formatRequest: jest.fn(({ request }) => ({
        ...request,
        prompt: `Context:\n- saved\n\n${request.prompt}`,
      })),
    });

    const { result } = renderHook(() => useContextInference({ query }), {
      wrapper: createWrapper(engine),
    });

    await act(async () => {
      await result.current?.({ prompt: 'hello' });
    });

    expect(engine.search).toHaveBeenCalledWith(query);
    expect(engine.formatRequest).toHaveBeenCalled();
    expect(mockPipe.generate).toHaveBeenCalledWith({
      prompt: 'Context:\n- saved\n\nhello',
    });
  });

  it('should derive query when query is omitted', async () => {
    const derived: ContextQuery = { text: 'derived', limit: 3 };
    const engine = createContextEngineMock({
      deriveQuery: jest.fn(() => derived),
    });

    const { result } = renderHook(() => useContextInference(), {
      wrapper: createWrapper(engine),
    });

    await act(async () => {
      await result.current?.({ prompt: 'hello' });
    });

    expect(engine.deriveQuery).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ prompt: 'hello' })
    );
    expect(engine.search).toHaveBeenCalledWith(derived);
  });

  it('should surface context errors and skip inference', async () => {
    const query: ContextQuery = { text: 'error', limit: 1 };
    const error = new Error('context failed');
    const engine = createContextEngineMock({
      search: jest.fn(async () => {
        throw error;
      }),
    });
    let received: Error | undefined;

    const { result } = renderHook(
      () => useContextInference({ query, onError: (err) => (received = err) }),
      { wrapper: createWrapper(engine) }
    );

    await act(async () => {
      await result.current?.({ prompt: 'hello' });
    });

    expect(received).toBe(error);
    expect(mockPipe.generate).not.toHaveBeenCalled();
  });

  it('should augment async inference with context', async () => {
    const query: ContextQuery = { text: 'async', limit: 1 };
    const engine = createContextEngineMock({
      formatRequest: jest.fn(({ request }) => ({
        ...request,
        prompt: `ctx:${request.prompt}`,
      })),
    });

    const { result } = renderHook(() => useContextInferenceAsync({ query }), {
      wrapper: createWrapper(engine),
    });

    await act(async () => {
      await result.current?.({ prompt: 'hello' });
    });

    expect(engine.search).toHaveBeenCalledWith(query);
    expect(mockPipe.generateAsync).toHaveBeenCalledWith(
      { prompt: 'ctx:hello' },
      expect.any(Object)
    );
  });
});
