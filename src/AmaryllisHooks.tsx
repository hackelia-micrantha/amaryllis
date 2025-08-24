import { useState, useCallback } from 'react';
import type { LlmRequestParams } from './Types';
import { generateLLM$ } from './AmaryllisRx';
import { useLLMContext } from './AmaryllisContext';

export const useInference = () => {
  const { config, error: configError } = useLLMContext();
  const [isLoading, setIsLoading] = useState<boolean>(!config);
  const [error, setError] = useState<Error | null>(configError);
  const [results, setResults] = useState<string[]>([]);

  const generate = useCallback((params: LlmRequestParams) => {
    setResults([]);
    setError(null);
    setIsLoading(false);

    const subscription = generateLLM$(params).subscribe({
      next: ({ partial, final }) => {
        if (partial) setResults((prev) => [...prev, partial]);
        if (final) setResults((prev) => [...prev, final]);
      },
      complete: () => {
        setIsLoading(false);
      },
      error: (err) => {
        setError(err);
        setIsLoading(false);
      },
    });

    return subscription.unsubscribe.bind(subscription);
  }, []);

  return { results, generate, isLoading, error };
};
