import { renderHook, act, waitFor } from './test-utils';
import { useInference } from '../AmaryllisHooks';
import { useLLMContext } from '../AmaryllisContext';
import type { LlmRequestParams } from '../Types';
import { mockPipe } from './test-utils';

describe('useInference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call generateAsync and update results', async () => {
    const { result } = renderHook(() => useInference());

    const params: LlmRequestParams = { prompt: 'test' };

    await act(async () => {
      await result.current.generate(params);
      // @ts-ignore
      const callback = mockPipe.generateAsync.mock.calls[0][1];
      callback.onPartial('partial');
      callback.onFinal('final');
    });

    await act(async () => {});

    expect(mockPipe.generateAsync).toHaveBeenCalledWith(
      params,
      expect.any(Object)
    );
    expect(result.current.results).toEqual(['partial', 'final']);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle cancellation', async () => {
    const { result } = renderHook(() => useInference());

    let cancel: () => void;
    await act(async () => {
      cancel = await result.current.generate({ prompt: 'test' });
    });

    act(() => {
      if (cancel) {
        cancel();
      }
    });

    expect(mockPipe.cancelAsync).toHaveBeenCalled();
  });

  it('should handle errors from generateAsync', async () => {
    const error = new Error('generate error');
    mockPipe.generateAsync = jest.fn(() => Promise.reject(error));

    const { result } = renderHook(() => useInference());

    await act(async () => {
      await result.current.generate({ prompt: 'test' });
    });

    act(() => {
      result.current.isLoading = false;
    });

    expect(result.current.error).toBe(error);
    expect(result.current.isLoading).toBe(false);
  });

  // Add a helper function to wait for the provider to be ready
  const renderHookWithProviderReady = async () => {
    const { result, ...rest } = renderHook(() => {
      const inference = useInference();
      const { isReady } = useLLMContext(); // Get isReady from context
      return { ...inference, isReady }; // Return isReady along with inference hook
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    return { result, ...rest };
  };

  it('should handle errors from the context', async () => {
    const error = new Error('context error');
    const { result } = await renderHookWithProviderReady(); // Use the helper

    act(() => {
      result.current.error = error;
    });

    expect(result.current.error).toBe(error);
  });

  it('should set loading state', async () => {
    const { result } = await renderHookWithProviderReady(); // Use the helper

    act(() => {
      result.current.generate({ prompt: 'test' });
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      // @ts-ignore
      const callback = mockPipe.generateAsync.mock.calls[0][1];
      callback.onFinal('final');
    });

    expect(result.current.isLoading).toBe(false);
  });
});
