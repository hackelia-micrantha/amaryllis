import { createLLMObservable } from '../AmaryllisRx';
import type { LLMResult } from '../Types';

describe('AmaryllisRx', () => {
  describe('createLLMObservable', () => {
    it('should create observable and callbacks', () => {
      const { observable, callbacks } = createLLMObservable();

      expect(observable).toBeDefined();
      expect(callbacks).toHaveProperty('onPartialResult');
      expect(callbacks).toHaveProperty('onFinalResult');
      expect(callbacks).toHaveProperty('onError');
      expect(typeof callbacks.onPartialResult).toBe('function');
      expect(typeof callbacks.onFinalResult).toBe('function');
      expect(typeof callbacks.onError).toBe('function');
    });

    it('should emit partial results when onPartialResult is called', () => {
      const { observable, callbacks } = createLLMObservable();
      const results: LLMResult[] = [];

      const subscription = observable.subscribe((result) => {
        results.push(result);
      });

      callbacks.onPartialResult?.('partial1');
      callbacks.onPartialResult?.('partial2');

      subscription.unsubscribe();

      expect(results).toEqual([
        { text: 'partial1', isFinal: false },
        { text: 'partial2', isFinal: false },
      ]);
    });

    it('should emit final result when onFinalResult is called', () => {
      const { observable, callbacks } = createLLMObservable();
      const results: LLMResult[] = [];

      const subscription = observable.subscribe((result) => {
        results.push(result);
      });

      callbacks.onPartialResult?.('partial');
      callbacks.onFinalResult?.('final');

      subscription.unsubscribe();

      expect(results).toEqual([
        { text: 'partial', isFinal: false },
        { text: 'final', isFinal: true },
      ]);
    });

    it('should emit error when onError is called', () => {
      const { observable, callbacks } = createLLMObservable();
      const testError = new Error('Test error');
      let capturedError: Error | undefined;

      const subscription = observable.subscribe({
        next: () => {
          fail('Should not emit next on error');
        },
        error: (error) => {
          capturedError = error;
        },
      });

      callbacks.onError?.(testError);

      subscription.unsubscribe();

      expect(capturedError).toBe(testError);
    });

    it('should handle subscriber cleanup', () => {
      const { observable, callbacks } = createLLMObservable();
      let subscriptionCount = 0;

      const subscription = observable.subscribe(() => {
        subscriptionCount++;
      });

      callbacks.onPartialResult?.('test1');
      expect(subscriptionCount).toBe(1);

      subscription.unsubscribe();
      callbacks.onPartialResult?.('test2');
      expect(subscriptionCount).toBe(1); // Should not increment after unsubscribe
    });

    it('should handle callbacks being called after unsubscribe', () => {
      const { observable, callbacks } = createLLMObservable();
      let resultCount = 0;

      const subscription = observable.subscribe(() => {
        resultCount++;
      });

      subscription.unsubscribe();

      // These should not cause errors even after unsubscribe
      expect(() => {
        callbacks.onPartialResult?.('test');
        callbacks.onFinalResult?.('final');
        callbacks.onError?.(new Error('test'));
      }).not.toThrow();

      expect(resultCount).toBe(0);
    });

    it('should handle rapid successive calls', () => {
      const { observable, callbacks } = createLLMObservable();
      const results: LLMResult[] = [];

      const subscription = observable.subscribe((result) => {
        results.push(result);
      });

      // Rapid calls
      callbacks.onPartialResult?.('p1');
      callbacks.onPartialResult?.('p2');
      callbacks.onPartialResult?.('p3');
      callbacks.onFinalResult?.('final');

      subscription.unsubscribe();

      expect(results).toEqual([
        { text: 'p1', isFinal: false },
        { text: 'p2', isFinal: false },
        { text: 'p3', isFinal: false },
        { text: 'final', isFinal: true },
      ]);
    });

    it('should handle empty strings', () => {
      const { observable, callbacks } = createLLMObservable();
      const results: LLMResult[] = [];

      const subscription = observable.subscribe((result) => {
        results.push(result);
      });

      callbacks.onPartialResult?.('');
      callbacks.onFinalResult?.('');

      subscription.unsubscribe();

      expect(results).toEqual([
        { text: '', isFinal: false },
        { text: '', isFinal: true },
      ]);
    });

    it('should handle special characters', () => {
      const { observable, callbacks } = createLLMObservable();
      const specialText = 'Special chars: \n\r\t"\'\\ and emojis 🚀🔥';
      const results: LLMResult[] = [];

      const subscription = observable.subscribe((result) => {
        results.push(result);
      });

      callbacks.onFinalResult?.(specialText);

      subscription.unsubscribe();

      expect(results).toEqual([{ text: specialText, isFinal: true }]);
    });
  });
});
