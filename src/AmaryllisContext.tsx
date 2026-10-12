import { createContext, useContext, useEffect, useState } from 'react';
import type {
  LlmEngine,
  LlmEngineConfig,
  LLMContextValue,
  LLMProviderProps,
} from './Types';
import { newLlmPipe } from './NativePipe';
import { InitializationError, isAmaryllisError } from './Errors';

const LLMContext = createContext<LLMContextValue>({
  config: null,
  controller: null,
  error: undefined,
  isReady: false,
});

export const useLLMContext = () => useContext(LLMContext);

type ProviderState =
  | {
      status: 'initializing';
      config: LlmEngineConfig;
      injectedEngine?: LlmEngine;
      controller: null;
      error: undefined;
    }
  | {
      status: 'ready';
      config: LlmEngineConfig;
      injectedEngine?: LlmEngine;
      controller: LlmEngine;
      error: undefined;
    }
  | {
      status: 'failed';
      config: LlmEngineConfig;
      injectedEngine?: LlmEngine;
      controller: null;
      error: Error;
    };

const initializing = (
  config: LlmEngineConfig,
  injectedEngine?: LlmEngine
): ProviderState => ({
  status: 'initializing',
  config,
  injectedEngine,
  controller: null,
  error: undefined,
});

/**
 * Publishes a controller only after initialization has completed for the
 * current config and engine identity. Reconfiguration withdraws old authority
 * immediately, before effect cleanup and replacement initialization.
 */
export const LLMProvider = ({
  config,
  llmPipe,
  children,
}: LLMProviderProps) => {
  const [state, setState] = useState<ProviderState>(() =>
    initializing(config, llmPipe)
  );

  useEffect(() => {
    let active = true;
    let candidate: LlmEngine | undefined;
    let closed = false;

    const closeCandidate = () => {
      if (!candidate || closed) return;
      closed = true;
      try {
        candidate.close();
      } catch (e: unknown) {
        console.warn('Error closing LLM controller:', e);
      }
    };

    setState(initializing(config, llmPipe));

    const start = async () => {
      try {
        const engine = llmPipe ?? newLlmPipe();
        candidate = engine;
        await engine.init(config);
        if (!active) {
          closeCandidate();
          return;
        }
        setState({
          status: 'ready',
          config,
          injectedEngine: llmPipe,
          controller: engine,
          error: undefined,
        });
      } catch (e: unknown) {
        closeCandidate();
        if (!active) return;
        const error = isAmaryllisError(e)
          ? e
          : new InitializationError(
              e instanceof Error ? e.message : 'Failed to initialize LLM'
            );
        setState({
          status: 'failed',
          config,
          injectedEngine: llmPipe,
          controller: null,
          error,
        });
      }
    };

    void start();
    return () => {
      active = false;
      closeCandidate();
    };
  }, [config, llmPipe]);

  // Identity comparison withdraws the previously ready controller during the
  // very first render of a reconfiguration, before passive effects can run.
  const current =
    state.config === config && state.injectedEngine === llmPipe
      ? state
      : initializing(config, llmPipe);

  return (
    <LLMContext.Provider
      value={{
        config,
        controller: current.controller,
        isReady: current.status === 'ready',
        error: current.error,
      }}
    >
      {children}
    </LLMContext.Provider>
  );
};
