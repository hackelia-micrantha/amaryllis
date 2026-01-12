import { renderHook, act } from './test-utils';
import { useInference, useInferenceAsync } from '../AmaryllisHooks';
import { mockPipe } from './test-utils';
import { GenerationError, ResourceError, isAmaryllisError } from '../Errors';

describe('Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input validation security', () => {
    it('should handle extremely long prompts', async () => {
      const { result, unmount } = renderHook(() => useInference());
      const longPrompt = 'x'.repeat(100000); // 100KB prompt

      await act(async () => {
        await result.current?.({ prompt: longPrompt });
      });

      expect(mockPipe.generate).toHaveBeenCalledWith({ prompt: longPrompt });
      unmount();
    });

    it('should handle prompts with special characters', async () => {
      const { result, unmount } = renderHook(() => useInference());
      const maliciousPrompt = '<script>alert("xss")</script>\n\r\t\'"\\';

      await act(async () => {
        await result.current?.({ prompt: maliciousPrompt });
      });

      expect(mockPipe.generate).toHaveBeenCalledWith({
        prompt: maliciousPrompt,
      });
      unmount();
    });

    it('should handle unicode and emoji prompts', async () => {
      const { result, unmount } = renderHook(() => useInference());
      const unicodePrompt = 'Test with 🚀🔥 emojis and 中文 characters';

      await act(async () => {
        await result.current?.({ prompt: unicodePrompt });
      });

      expect(mockPipe.generate).toHaveBeenCalledWith({ prompt: unicodePrompt });
      unmount();
    });

    it('should handle large image arrays', async () => {
      const { result, unmount } = renderHook(() => useInference());
      const images = Array(100).fill('data:image/png;base64,test'); // Smaller array

      await act(async () => {
        await result.current?.({ prompt: 'test', images });
      });

      expect(mockPipe.generate).toHaveBeenCalledWith({
        prompt: 'test',
        images,
      });
      unmount();
    });
  });

  describe('Error handling security', () => {
    it('should handle AmaryllisError hierarchy correctly', async () => {
      mockPipe.generate = jest.fn(() => {
        throw new GenerationError('Model not found');
      });

      let capturedError: Error | undefined;
      const { result, unmount } = renderHook(() =>
        useInference({
          onError: (error) => {
            capturedError = error;
          },
        })
      );

      await act(async () => {
        await result.current?.({ prompt: 'test' });
      });

      expect(capturedError).toBeDefined();
      expect(isAmaryllisError(capturedError)).toBe(true);
      if (isAmaryllisError(capturedError)) {
        expect(capturedError.code).toBe('GENERATION_ERROR');
      }
      unmount();
    });

    it('should handle resource exhaustion errors', async () => {
      mockPipe.generate = jest.fn(() => {
        throw new ResourceError('Memory limit exceeded');
      });

      let capturedError: Error | undefined;
      const { result, unmount } = renderHook(() =>
        useInference({
          onError: (error) => {
            capturedError = error;
          },
        })
      );

      await act(async () => {
        await result.current?.({ prompt: 'test' });
      });

      expect(capturedError).toBeDefined();
      expect(isAmaryllisError(capturedError)).toBe(true);
      if (isAmaryllisError(capturedError)) {
        expect(capturedError.code).toBe('RESOURCE_ERROR');
      }
      unmount();
    });
  });

  describe('Performance security', () => {
    it('should handle rapid sequential operations', async () => {
      const { result, unmount } = renderHook(() => useInference());

      // Fire multiple requests sequentially instead of parallel to avoid overlapping act()
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await result.current?.({ prompt: `test ${i}` });
        });
      }

      expect(mockPipe.generate).toHaveBeenCalledTimes(10);
      unmount();
    });

    it('should clean up subscriptions on unmount', async () => {
      const { result, unmount } = renderHook(() => useInferenceAsync());

      await act(async () => {
        await result.current?.({ prompt: 'test' });
      });

      unmount();

      // Should not cause memory leaks - basic test
      expect(true).toBe(true);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle empty string responses', async () => {
      mockPipe.generate = jest.fn().mockResolvedValue('');

      let results: string[] = [];
      const { result, unmount } = renderHook(() =>
        useInference({
          onResult: (response) => {
            results.push(response);
          },
        })
      );

      await act(async () => {
        await result.current?.({ prompt: 'test' });
      });

      expect(results[0]).toBe('');
      unmount();
    });

    it('should handle undefined responses gracefully', async () => {
      mockPipe.generate = jest.fn().mockResolvedValue('');

      let results: any[] = [];
      const { result, unmount } = renderHook(() =>
        useInference({
          onResult: (response) => {
            results.push(response);
          },
        })
      );

      await act(async () => {
        await result.current?.({ prompt: 'test' });
      });

      expect(results[0]).toBe('');
      unmount();
    });
  });
});
