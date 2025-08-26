import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { LlmEngineConfig } from './Types';
import { LlmPipe } from './Amaryllis';

interface LLMContextValue {
  config: LlmEngineConfig | null;
  controller?: LlmPipe;
  isReady: boolean;
}

const LLMContext = createContext<LLMContextValue>({
  config: null,
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
  const controller = useMemo(() => new LlmPipe(), []);

  useEffect(() => {
    const start = async () => await controller.init(config);
    start();
    return () => controller.close();
  }, [config, controller]);

  return (
    <LLMContext.Provider
      value={{
        config,
        controller,
        isReady: config !== null && controller !== undefined,
      }}
    >
      {children}
    </LLMContext.Provider>
  );
};
