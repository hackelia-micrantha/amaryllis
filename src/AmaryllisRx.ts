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
    onEvent: (event) => {
      if (!subscriber) {
        return;
      }
      if (event.type === 'error') {
        subscriber.error(event.error);
        return;
      }
      subscriber.next({ text: event.text, isFinal: event.type === 'final' });
    },
  };

  return { observable, callbacks };
}
