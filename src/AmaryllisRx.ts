import type { LlmCallbacks, LLMObservableResult, LLMResult } from './Types';
import { Observable, Subscriber } from 'rxjs';

export function createLLMObservable(): LLMObservableResult {
  let subscriber: Subscriber<LLMResult> | null = null;
  let fullText = '';

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

      fullText += event.text;

      if (event.type === 'final') {
        subscriber.next({ text: fullText, isFinal: true });
        subscriber.complete();
        return;
      }
      subscriber.next({ text: fullText, isFinal: false });
    },
  };

  return { observable, callbacks };
}
