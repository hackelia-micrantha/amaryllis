import { renderHook, act } from './test-utils';
import { useInference, useInferenceAsync } from '../AmaryllisHooks';
import { mockPipe } from './test-utils';
import type { LlmRequestParams } from '../Types';

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
      callback.onPartialResult('partial');
      callback.onFinalResult('final');
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
