import type {
  LlmRequestParams,
  LlmEngineConfig,
  LlmSessionParams,
  LlmCallbacks,
} from './Types';
import { Observable } from 'rxjs';
import Amaryllis from './Amaryllis';

interface LLMResult {
  partial?: string;
  final?: string;
}

/**
 * Returns an Observable that configures the LLM engine.
 * Emits `true` when configuration is complete.
 */
export const configureLLM$ = (
  config: LlmEngineConfig,
  newSession?: LlmSessionParams
): Observable<boolean> => {
  return new Observable<boolean>((subscriber) => {
    Amaryllis.init(config, newSession)
      .then(() => {
        subscriber.next(true);
        subscriber.complete();
      })
      .catch((err: string) => {
        subscriber.error(new Error(err));
      });
  });
};

/**
 * Returns an observable that emits partial results as they come
 * and a final result once done.
 */
export const generateLLM$ = (
  params: LlmRequestParams,
  newSession?: LlmSessionParams
): Observable<LLMResult> => {
  return new Observable<LLMResult>((subscriber) => {
    const callbacks: LlmCallbacks = {
      onPartialResult: (partial: string) => {
        subscriber.next({ partial });
      },

      onError: (error: Error) => {
        subscriber.error(error);
        subscriber.complete();
      },

      onFinalResult: (final: string) => {
        subscriber.next({ final });
        subscriber.complete();
      },
    };

    // Trigger the async generation
    Amaryllis.generateAsync(params, newSession, callbacks);

    // Cleanup on unsubscribe
    return () => {
      Amaryllis.cancelAsync();
    };
  });
};
