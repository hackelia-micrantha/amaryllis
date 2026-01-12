import type { LlmCallbacks, LLMObservableResult, LLMResult } from './Types';
import { Observable, Subscriber } from 'rxjs';

export function createLLMObservable(): LLMObservableResult {
  let subscriber: Subscriber<LLMResult> | null = null;

  const observable = new Observable<LLMResult>((sub) => {
    subscriber = sub;
    return () => {
      subscriber = null;
    };
  });

  const callbacks: LlmCallbacks = {
    onPartialResult: (partial) => {
      if (subscriber) {
        subscriber.next({ text: partial, isFinal: false });
      }
    },
    onFinalResult: (final) => {
      if (subscriber) {
        subscriber.next({ text: final, isFinal: true });
      }
    },
    onError: (error) => {
      if (subscriber) {
        subscriber.error(error);
      }
    },
  };

  return { observable, callbacks };
}
