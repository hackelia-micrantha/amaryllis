import type { LlmCallbacks } from './Types';
import { Observable, Subscriber } from 'rxjs';

export interface LLMObservableResult {
  callbacks: LlmCallbacks;
  observable: Observable<string>;
}

export function createLLMObservable(): LLMObservableResult {
  let subscriber: Subscriber<string>;

  const observable = new Observable<string>((sub) => {
    subscriber = sub;
  });

  const callbacks: LlmCallbacks = {
    onPartialResult: (partial) => {
      subscriber?.next(partial);
    },
    onFinalResult: (final) => {
      if (final) {
        subscriber?.next(final);
      }
      subscriber?.complete();
    },
    onError: (error) => {
      subscriber?.error(error);
    },
  };

  return { observable, callbacks };
}
