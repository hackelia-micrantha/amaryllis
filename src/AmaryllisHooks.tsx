import { useCallback, useMemo, useEffect } from 'react';
import type { LlmRequestParams, InferenceProps } from './Types';
import { useLLMContext } from './AmaryllisContext';
import { createLLMObservable } from './AmaryllisRx';

export const useInferenceAsync = (props: InferenceProps = {}) => {
  const { controller } = useLLMContext();
  const { onResult, onGenerate, onError, onComplete } = props;

  const llm$ = useMemo(() => createLLMObservable(), []);

  const generate = useCallback(
    async (params: LlmRequestParams) => {
      if (!controller) {
        onError?.(new Error('Controller not initialized'));
        return () => {
          onComplete?.();
        };
      }

      try {
        onGenerate?.();
        await controller.generateAsync(params, llm$.callbacks);
      } catch (err) {
        onError?.(
          err instanceof Error ? err : new Error('An unknown error occurred')
        );
      }
      return () => {
        controller.cancelAsync();
        onComplete?.();
      };
    },
    [controller, llm$.callbacks, onComplete, onGenerate, onError]
  );

  useEffect(() => {
    const sub = llm$.observable.subscribe({
      next: ({ text, isFinal }) => {
        onResult?.(text, isFinal);
      },
      complete: () => onComplete?.(),
      error: (err) => onError?.(err),
    });

    return () => {
      sub.unsubscribe();
      controller?.cancelAsync();
    };
  }, [llm$.observable, controller, onResult, onComplete, onError]);
  return generate;
};

export const useInference = (props: InferenceProps = {}) => {
  const { controller, error: contextError } = useLLMContext();
  const { onResult, onError, onGenerate, onComplete } = props;

  useEffect(() => {
    if (contextError) {
      onError?.(contextError);
    }
  }, [contextError, onError]);

  const generate = useCallback(
    async (params: LlmRequestParams) => {
      if (!controller) {
        onError?.(new Error('Controller not initialized'));
        return () => {
          onComplete?.();
        };
      }

      try {
        onGenerate?.();
        const response = await controller.generate(params);
        onResult?.(response ?? '', true);
      } catch (err) {
        onError?.(
          err instanceof Error ? err : new Error('An unknown error occurred')
        );
      }

      return () => {
        controller.cancelAsync();
        onComplete?.();
      };
    },
    [onGenerate, controller, onResult, onError, onComplete]
  );

  return generate;
};
