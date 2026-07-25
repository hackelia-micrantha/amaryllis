import { useCallback, useEffect, useRef } from 'react';
import type { InferenceProps, LlmRequestParams } from './Types';
import { useLLMContext } from './AmaryllisContext';
import { GenerationInProgressError } from './Errors';
import { createLLMObservable } from './AmaryllisRx';
import { useContextEngine } from './ContextEngineContext';
import type { ContextEngine, ContextQuery } from './ContextTypes';
import { validateLlmRequestParams } from './TypeConverters';

const defaultProtocol = {
  formatRequest: (params: LlmRequestParams) => params,
  sanitizeOutput: (text: string) => text,
};

export type ContextInferenceProps = InferenceProps & {
  contextEngine?: ContextEngine;
  query?: ContextQuery;
};

type ActiveAsyncGeneration = {
  settled: boolean;
  unsubscribe: () => void;
  cancel: (notifyComplete?: boolean) => void;
  notifyCompleteOnCancellation: boolean;
};

const useContextAugmentation = (
  contextEngine?: ContextEngine,
  query?: ContextQuery
) => {
  const engineFromProvider = useContextEngine();
  const engine = contextEngine ?? engineFromProvider;

  return useCallback(
    async (params: LlmRequestParams): Promise<LlmRequestParams> => {
      if (!engine) {
        return params;
      }
      const resolvedQuery = query ?? engine.deriveQuery(params.prompt, params);
      if (!resolvedQuery) {
        return params;
      }
      const items = await engine.search(resolvedQuery);
      return engine.formatRequest({
        prompt: params.prompt,
        items,
        query: resolvedQuery,
        request: params,
      });
    },
    [engine, query]
  );
};

export const useInferenceAsync = (props: InferenceProps = {}) => {
  const { controller, config } = useLLMContext();
  const { onResult, onGenerate, onError, onComplete } = props;
  const protocol = config?.protocol ?? defaultProtocol;

  const onResultRef = useRef(onResult);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const activeGenerationRef = useRef<ActiveAsyncGeneration | null>(null);

  useEffect(() => {
    onResultRef.current = onResult;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onResult, onComplete, onError]);

  const finishGeneration = useCallback(
    (generation: ActiveAsyncGeneration, notifyComplete = true) => {
      if (generation.settled) {
        return;
      }

      generation.settled = true;
      generation.unsubscribe();
      if (activeGenerationRef.current === generation) {
        activeGenerationRef.current = null;
      }
      if (notifyComplete) {
        onCompleteRef.current?.();
      }
    },
    []
  );

  const generate = useCallback(
    async (params: LlmRequestParams) => {
      if (!controller) {
        onErrorRef.current?.(new Error('Controller not initialized'));
        onCompleteRef.current?.();
        return () => {};
      }

      if (activeGenerationRef.current) {
        onErrorRef.current?.(new GenerationInProgressError());
        return () => {};
      }

      let formattedParams: LlmRequestParams;
      try {
        validateLlmRequestParams(params);
        formattedParams = protocol.formatRequest(params);
      } catch (err) {
        onErrorRef.current?.(
          err instanceof Error ? err : new Error('An unknown error occurred')
        );
        onCompleteRef.current?.();
        return () => {};
      }

      const llm$ = createLLMObservable();
      const generation: ActiveAsyncGeneration = {
        settled: false,
        unsubscribe: () => {},
        cancel: () => {},
        notifyCompleteOnCancellation: true,
      };

      const subscription = llm$.observable.subscribe({
        next: ({ text, isFinal }) => {
          onResultRef.current?.(protocol.sanitizeOutput(text), isFinal);
        },
        complete: () => finishGeneration(generation),
        error: (err) => {
          onErrorRef.current?.(
            err instanceof Error ? err : new Error('An unknown error occurred')
          );
          finishGeneration(generation);
        },
      });

      generation.unsubscribe = () => subscription.unsubscribe();
      generation.cancel = (notifyComplete = true) => {
        if (generation.settled) {
          return;
        }

        generation.notifyCompleteOnCancellation = notifyComplete;
        try {
          controller.cancelAsync();
        } catch (err) {
          onErrorRef.current?.(
            err instanceof Error ? err : new Error('An unknown error occurred')
          );
        } finally {
          finishGeneration(generation, notifyComplete);
        }
      };
      activeGenerationRef.current = generation;

      try {
        onGenerate?.();
        await controller.generateAsync(formattedParams, llm$.callbacks);
      } catch (err) {
        if (!generation.settled) {
          onErrorRef.current?.(
            err instanceof Error ? err : new Error('An unknown error occurred')
          );
          finishGeneration(generation);
        }
      }

      return () => generation.cancel();
    },
    [controller, finishGeneration, onGenerate, protocol]
  );

  useEffect(() => {
    if (!controller?.subscribeAsyncLifecycle) {
      return;
    }

    return controller.subscribeAsyncLifecycle(() => {
      const generation = activeGenerationRef.current;
      if (generation) {
        finishGeneration(
          generation,
          generation.notifyCompleteOnCancellation
        );
      }
    });
  }, [controller, finishGeneration]);

  useEffect(() => {
    return () => {
      activeGenerationRef.current?.cancel(false);
    };
  }, [controller]);

  return generate;
};

export const useInference = (props: InferenceProps = {}) => {
  const { controller, error: contextError, config } = useLLMContext();
  const { onResult, onError, onGenerate, onComplete } = props;
  const protocol = config?.protocol ?? defaultProtocol;

  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
    onCompleteRef.current = onComplete;
  }, [onResult, onError, onComplete]);

  useEffect(() => {
    if (contextError) {
      onErrorRef.current?.(contextError);
    }
  }, [contextError]);

  const generate = useCallback(
    async (params: LlmRequestParams) => {
      if (!controller) {
        onErrorRef.current?.(new Error('Controller not initialized'));
        return () => {
          onCompleteRef.current?.();
        };
      }

      try {
        validateLlmRequestParams(params);
        onGenerate?.();
        const response = await controller.generate(
          protocol.formatRequest(params)
        );
        onResultRef.current?.(protocol.sanitizeOutput(response ?? ''), true);
      } catch (err) {
        onErrorRef.current?.(
          err instanceof Error ? err : new Error('An unknown error occurred')
        );
      }

      return () => {
        controller.cancelAsync();
        onCompleteRef.current?.();
      };
    },
    [onGenerate, controller, protocol]
  );

  return generate;
};

export const useContextInferenceAsync = (props: ContextInferenceProps = {}) => {
  const { contextEngine, query, ...inferenceProps } = props;
  const { onComplete, onError } = inferenceProps;
  const augmentRequest = useContextAugmentation(contextEngine, query);
  const activeRequestRef = useRef<number | null>(null);
  const nextRequestIdRef = useRef(1);
  const mountedRef = useRef(true);

  const handleBaseError = useCallback(
    (error: Error) => {
      if (error instanceof GenerationInProgressError) {
        activeRequestRef.current = null;
      }
      onError?.(error);
    },
    [onError]
  );

  const handleBaseComplete = useCallback(() => {
    activeRequestRef.current = null;
    onComplete?.();
  }, [onComplete]);

  const generateBase = useInferenceAsync({
    ...inferenceProps,
    onError: handleBaseError,
    onComplete: handleBaseComplete,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestRef.current = null;
    };
  }, []);

  const generate = useCallback(
    async (params: LlmRequestParams) => {
      if (activeRequestRef.current !== null) {
        onError?.(new GenerationInProgressError());
        return () => {};
      }

      const requestId = nextRequestIdRef.current++;
      activeRequestRef.current = requestId;
      let cancelled = false;
      let cancelBase: (() => void) | undefined;

      const cancel = () => {
        if (cancelled) {
          return;
        }
        cancelled = true;
        if (activeRequestRef.current === requestId) {
          activeRequestRef.current = null;
        }
        cancelBase?.();
      };

      try {
        const augmented = await augmentRequest(params);
        if (
          cancelled ||
          !mountedRef.current ||
          activeRequestRef.current !== requestId
        ) {
          if (activeRequestRef.current === requestId) {
            activeRequestRef.current = null;
          }
          return cancel;
        }

        cancelBase = await generateBase(augmented);
        if (cancelled) {
          cancelBase();
        }
        return cancel;
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          onError?.(
            err instanceof Error ? err : new Error('An unknown error occurred')
          );
          if (activeRequestRef.current === requestId) {
            activeRequestRef.current = null;
          }
          onComplete?.();
        }
        return cancel;
      }
    },
    [augmentRequest, generateBase, onComplete, onError]
  );

  return generate;
};

export const useContextInference = (props: ContextInferenceProps = {}) => {
  const { contextEngine, query, ...inferenceProps } = props;
  const { onComplete, onError } = inferenceProps;
  const augmentRequest = useContextAugmentation(contextEngine, query);
  const generateBase = useInference(inferenceProps);

  const generate = useCallback(
    async (params: LlmRequestParams) => {
      try {
        const augmented = await augmentRequest(params);
        return await generateBase(augmented);
      } catch (err) {
        onError?.(
          err instanceof Error ? err : new Error('An unknown error occurred')
        );
        return () => {
          onComplete?.();
        };
      }
    },
    [augmentRequest, generateBase, onComplete, onError]
  );

  return generate;
};
