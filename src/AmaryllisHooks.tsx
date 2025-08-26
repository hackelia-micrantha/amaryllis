import { useState, useCallback, useMemo } from 'react';
import type { LlmCallbacks, LlmRequestParams } from './Types';
import { useLLMContext } from './AmaryllisContext';

export const useInference = () => {
  const { controller } = useLLMContext();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [results, setResults] = useState<string[]>([]);

  const callbacks: LlmCallbacks = useMemo(
    () => ({
      onPartial: (result: string) => setResults((prev) => [...prev, result]),
      onFinal: (result: string) => {
        setResults((prev) => [...prev, result]);
        setIsLoading(false);
      },
      onError: (err: Error) => {
        setError(err);
        setIsLoading(false);
      },
    }),
    []
  );

  const generate = useCallback(
    async (params: LlmRequestParams) => {
      setResults([]);
      setError(null);
      setIsLoading(true);

      try {
        await controller?.generateAsync(params, callbacks);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('An unknown error occurred')
        );
      }

      return () => controller?.cancelAsync();
    },
    [callbacks, controller]
  );

  return { results, generate, isLoading, error };
};
