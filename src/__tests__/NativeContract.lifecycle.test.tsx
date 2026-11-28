import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { LlmPipe } from '../Amaryllis';
import { LLMProvider } from '../AmaryllisContext';
import { useInferenceAsync } from '../AmaryllisHooks';
import { GenerationInProgressError } from '../Errors';
import type {
  LlmEngineConfig,
  LlmEventEmitter,
  LlmNativeEngine,
} from '../Types';

const config: LlmEngineConfig = { modelPath: 'model.task' };

// A fresh native-boundary fixture per scenario. Cancellation requests do not
// settle the operation until the test explicitly delivers acknowledgement.
function createNativeFixture() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let active: { id: string; cancelling: boolean } | undefined;
  let initialized = false;

  const emit = (event: string, payload: unknown) => {
    [...(listeners.get(event) ?? [])].forEach((listener) => listener(payload));
  };

  const eventEmitter: LlmEventEmitter = {
    addListener(event, listener) {
      const group = listeners.get(event) ?? new Set();
      listeners.set(event, group);
      group.add(listener);
      return {
        remove() {
          group.delete(listener);
          if (group.size === 0) listeners.delete(event);
        },
      };
    },
  };

  const nativeModule: LlmNativeEngine = {
    init() {
      initialized = true;
      return Promise.resolve();
    },
    newSession() {
      return Promise.reject(new Error('Not exercised by this fixture'));
    },
    generate() {
      return Promise.reject(new Error('Not exercised by this fixture'));
    },
    generateAsync(_params, id) {
      if (!initialized || active) {
        return Promise.reject(new Error('Native request cannot start'));
      }
      active = { id, cancelling: false };
      return Promise.resolve();
    },
    cancelAsync(id) {
      if (active?.id === id) active.cancelling = true;
    },
    close() {
      initialized = false;
      active = undefined;
    },
  };

  const requestId = () => {
    if (!active) throw new Error('No active native request');
    return active.id;
  };

  return {
    nativeModule,
    eventEmitter,
    emit,
    requestId,
    get cancelling() {
      return active?.cancelling ?? false;
    },
    get listenerCount() {
      return [...listeners.values()].reduce((sum, group) => sum + group.size, 0);
    },
    acknowledgeCancellation() {
      if (!active?.cancelling) throw new Error('Cancellation not requested');
      const id = active.id;
      active = undefined;
      emit('onCancelled', { requestId: id });
    },
    finish(text: string, finalText: string) {
      const id = requestId();
      if (active?.cancelling) throw new Error('Request is cancelling');
      active = undefined;
      emit('onFinalResult', { requestId: id, text, finalText });
    },
  };
}

describe('real provider and pipe at the native event boundary', () => {
  it('holds ownership until cancellation acknowledgement and isolates the next stream', async () => {
    const native = createNativeFixture();
    const pipe = new LlmPipe(native);
    const contender = new LlmPipe(native);
    const results: Array<{ text: string; final: boolean }> = [];
    const errors: Error[] = [];
    let completions = 0;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LLMProvider config={config} llmPipe={pipe}>
        {children}
      </LLMProvider>
    );
    const { result, unmount } = renderHook(
      () =>
        useInferenceAsync({
          onResult: (text, final) => results.push({ text, final }),
          onError: (error) => errors.push(error),
          onComplete: () => {
            completions += 1;
          },
        }),
      { wrapper }
    );
    await act(async () => {});

    await act(async () => {
      const cancel = await result.current({ prompt: 'first' });
      native.emit('onPartialResult', {
        requestId: native.requestId(),
        text: 'first',
      });
      cancel();
    });
    const retiredId = native.requestId();
    expect(native.cancelling).toBe(true);
    expect(completions).toBe(0);

    await act(async () => {
      await result.current({ prompt: 'overlap' });
      await expect(
        contender.generateAsync({ prompt: 'other pipe' })
      ).rejects.toBeInstanceOf(GenerationInProgressError);
      native.emit('onPartialResult', {
        requestId: retiredId,
        text: 'ignored during cancellation',
      });
      native.acknowledgeCancellation();
    });
    expect(errors).toEqual([expect.any(GenerationInProgressError)]);
    expect(completions).toBe(1);
    expect(native.listenerCount).toBe(0);

    await act(async () => {
      await result.current({ prompt: 'replacement' });
      expect(native.requestId()).not.toBe(retiredId);
      native.emit('onFinalResult', {
        requestId: retiredId,
        text: 'stale final',
      });
      native.emit('onPartialResult', {
        requestId: native.requestId(),
        text: 'new',
      });
      native.finish(' result', 'new result');
    });
    expect(results).toEqual([
      { text: 'first', final: false },
      { text: 'new', final: false },
      { text: 'new result', final: true },
    ]);
    expect(completions).toBe(2);
    expect(native.listenerCount).toBe(0);
    unmount();
  });
});
