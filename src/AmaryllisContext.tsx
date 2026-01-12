import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { LLMContextValue, LLMProviderProps } from './Types';
import { newLlmPipe } from './NativePipe';
import { InitializationError, isAmaryllisError } from './Errors';

const LLMContext = createContext<LLMContextValue>({
  config: null,
  controller: null,
  error: undefined,
  isReady: false,
});

export const useLLMContext = () => useContext(LLMContext);

/**
 * Provides LLM configuration state to child components.
 * Configures LLM once on mount.
 */
export const LLMProvider = ({
  config,
  llmPipe,
  children,
}: LLMProviderProps) => {
  const [error, setError] = useState<Error | undefined>();
  const [ready, setReady] = useState(false);
  const controller = useMemo(() => {
    try {
      return llmPipe ?? newLlmPipe();
    } catch (e: any) {
      const initError = isAmaryllisError(e)
        ? e
        : new InitializationError(e?.message || 'Failed to create LLM pipe');
      setError(initError);
      return null;
    }
  }, [llmPipe]);

  useEffect(() => {
    const start = async () => {
      if (!controller) return;

      try {
        await controller.init(config);
        setReady(true);
      } catch (e: any) {
        console.error('unable to start amaryllis', e);
        const initError = isAmaryllisError(e)
          ? e
          : new InitializationError(e?.message || 'Failed to initialize LLM');
        setError(initError);
      }
    };
    start();
    return () => {
      try {
        controller?.close();
      } catch (e: any) {
        console.warn('Error closing LLM controller:', e);
      }
    };
  }, [config, controller]);

  return (
    <LLMContext.Provider value={{ config, controller, isReady: ready, error }}>
      {children}
    </LLMContext.Provider>
  );
};
