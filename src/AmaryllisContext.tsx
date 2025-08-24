import React, { createContext, useContext, useEffect, useState } from 'react';
import type { LlmEngineConfig } from './Types';
import { configureLLM$ } from './AmaryllisRx';

interface LLMContextValue {
  config: LlmEngineConfig | null;
  error: Error | null;
  isReady: boolean;
}

const LLMContext = createContext<LLMContextValue>({
  config: null,
  error: null,
  isReady: false,
});

export const useLLMContext = () => useContext(LLMContext);

interface LLMProviderProps {
  config: LlmEngineConfig;
  children: React.ReactNode;
}

/**
 * Provides LLM configuration state to child components.
 * Configures LLM once on mount.
 */
export const LLMProvider = ({ config, children }: LLMProviderProps) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const subscription = configureLLM$(config).subscribe({
      next: () => setIsReady(true),
      error: (err: Error) => setError(err),
    });

    return () => subscription.unsubscribe();
  }, [config]);

  return (
    <LLMContext.Provider value={{ config, error, isReady }}>
      {children}
    </LLMContext.Provider>
  );
};
