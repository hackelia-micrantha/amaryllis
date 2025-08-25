import React, { createContext, useContext, useEffect, useState } from 'react';
import type { LlmEngineConfig, LlmSessionParams } from './Types';
import { configureLLM$ } from './AmaryllisRx';

interface LLMContextValue {
  config: LlmEngineConfig | null;
  newSession?: LlmSessionParams;
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
  newSession?: LlmSessionParams;
  children: React.ReactNode;
}

/**
 * Provides LLM configuration state to child components.
 * Configures LLM once on mount.
 */
export const LLMProvider = ({
  config,
  newSession,
  children,
}: LLMProviderProps) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const subscription = configureLLM$(config, newSession).subscribe({
      next: () => setIsReady(true),
      error: (err: Error) => setError(err),
    });

    return () => subscription.unsubscribe();
  }, [config, newSession]);

  return (
    <LLMContext.Provider value={{ config, newSession, error, isReady }}>
      {children}
    </LLMContext.Provider>
  );
};
