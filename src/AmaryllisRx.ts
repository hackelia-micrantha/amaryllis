import type { LlmCallbacks, LLMObservableResult, LLMResult } from './Types';
import { Observable, Subscriber } from 'rxjs';

export function createLLMObservable(): LLMObservableResult {
  let subscriber: Subscriber<LLMResult>;

  const observable = new Observable<LLMResult>((sub) => {
    subscriber = sub;
  });

  const callbacks: LlmCallbacks = {
    onPartialResult: (partial) => {
      subscriber?.next({ text: partial, isFinal: false });
    },
    onFinalResult: (final) => {
      subscriber?.next({ text: final, isFinal: true });
    },
    onError: (error) => {
      subscriber?.error(error);
    },
  };

  return { observable, callbacks };
}
