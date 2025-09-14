import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { LLMContextValue, LLMProviderProps } from './Types';
import { newLlmPipe } from './NativePipe';

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
      setError(e);
      return null;
    }
  }, [llmPipe]);

  useEffect(() => {
    const start = async () => {
      try {
        await controller?.init(config);
        setReady(true);
      } catch (e: any) {
        console.error('unable to start amaryllis', e);
        setError(e);
      }
    };
    start();
    return () => controller?.close();
  }, [config, controller]);

  return (
    <LLMContext.Provider value={{ config, controller, isReady: ready, error }}>
      {children}
    </LLMContext.Provider>
  );
};
