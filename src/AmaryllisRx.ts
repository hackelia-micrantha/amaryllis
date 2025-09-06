import type { LlmCallbacks } from './Types';
import { Observable, Subscriber } from 'rxjs';

export interface LLMResult {
  text: string;
  isFinal: boolean;
}

export interface LLMObservableResult {
  callbacks: LlmCallbacks;
  observable: Observable<LLMResult>;
}

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
