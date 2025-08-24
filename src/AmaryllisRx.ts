import type { LlmRequestParams, LlmEngineConfig } from './Types';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { Observable } from 'rxjs';
import Amaryllis from './NativeAmaryllis';

const emitter = new NativeEventEmitter(NativeModules.Amaryllis);

interface LLMResult {
  partial?: string;
  final?: string;
}

/**
 * Returns an Observable that configures the LLM engine.
 * Emits `true` when configuration is complete.
 */
export const configureLLM$ = (config: LlmEngineConfig): Observable<boolean> => {
  return new Observable<boolean>((subscriber) => {
    Amaryllis.init(config)
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
  params: LlmRequestParams
): Observable<LLMResult> => {
  return new Observable<LLMResult>((subscriber) => {
    // Subscribe to partial results
    const partialListener = emitter.addListener(
      'onPartialResult',
      (partial: string) => {
        subscriber.next({ partial });
      }
    );

    const errorListener = emitter.addListener('onError', (error: string) => {
      subscriber.error(new Error(error));
      subscriber.complete();
    });

    // Optional: You can emit a "final" event if your native module sends one
    const finalListener = emitter.addListener(
      'onFinalResult',
      (final: string) => {
        subscriber.next({ final });
        subscriber.complete();
      }
    );

    // Trigger the async generation
    Amaryllis.generateAsync(params);

    // Cleanup on unsubscribe
    return () => {
      partialListener.remove();
      finalListener.remove();
      errorListener.remove();
    };
  });
};
