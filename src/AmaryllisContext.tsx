import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  // Reconfigurations of a provider must not overlap native initialization on
  // the same injected engine or shared native module.
  const initializationChain = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    let candidate: LlmEngine | undefined;
    let closed = false;

    const closeCandidate = (afterPendingInit = false) => {
      if (!candidate || (closed && !afterPendingInit)) return;
      closed = true;
      try {
        candidate.close();
      } catch (e: unknown) {
        console.warn('Error closing LLM controller:', e);
      }
    };

    // The prior effect owns any pending native init. Do not begin a new init
    // until its result has settled and stale native resources have been closed.
    const previous = initializationChain.current;
    let release: () => void = () => {};
    initializationChain.current = new Promise<void>((resolve) => {
      release = resolve;
    });

    setState(initializing(config, llmPipe));

    const start = async () => {
      try {
        if (previous) await previous;
        if (!active) return;

        const engine = llmPipe ?? newLlmPipe();
        candidate = engine;
        await engine.init(config);
        if (!active) {
          // Cleanup may already have closed a still-initializing candidate.
          // Native resources can be allocated after that first close.
          closeCandidate(true);
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
        closeCandidate(!active && closed);
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
      } finally {
        release();
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
