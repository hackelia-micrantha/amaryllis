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
  let visionSession = false;

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
    newSession(params) {
      visionSession = params?.enableVisionModality === true;
      return Promise.resolve();
    },
    generate() {
      return Promise.reject(new Error('Not exercised by this fixture'));
    },
    generateAsync(params, id) {
      if (!initialized || active) {
        return Promise.reject(new Error('Native request cannot start'));
      }
      if (params.images?.length && !visionSession) {
        return Promise.reject(
          Object.assign(new Error('session is required'), {
            code: 'ERR_SESSION',
          })
        );
      }
      active = { id, cancelling: false };
      return Promise.resolve();
    },
    cancelAsync(id) {
      if (active?.id === id) active.cancelling = true;
    },
    close() {
      initialized = false;
      visionSession = false;
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
      let count = 0;
      for (const group of listeners.values()) {
        count += group.size;
      }
      return count;
    },
    acknowledgeCancellation() {
      if (!active?.cancelling) throw new Error('Cancellation not requested');
      const id = active.id;
      active = undefined;
      emit('onCancelled', { requestId: id });
    },
    fail(message: string, code: string) {
      const id = requestId();
      active = undefined;
      emit('onError', { requestId: id, message, code });
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

  it('releases ownership on startup rejection and preserves native error codes', async () => {
    const native = createNativeFixture();
    const pipe = new LlmPipe(native);
    await pipe.init(config);
    const request = { prompt: 'describe', images: ['file:///image.png'] };

    await expect(pipe.generateAsync(request)).rejects.toMatchObject({
      code: 'ERR_SESSION',
    });
    expect(native.listenerCount).toBe(0);

    await pipe.newSession({ enableVisionModality: true });
    const events: unknown[] = [];
    await pipe.generateAsync(request, {
      onEvent: (event) => events.push(event),
    });
    const failedId = native.requestId();
    native.fail('unable to generate response', 'ERR_INFER');
    expect(events).toEqual([
      {
        type: 'error',
        error: expect.objectContaining({
          message: 'unable to generate response',
          code: 'ERR_INFER',
        }),
      },
    ]);
    expect(native.listenerCount).toBe(0);

    await pipe.generateAsync({ prompt: 'retry' }, {
      onEvent: (event) => events.push(event),
    });
    native.emit('onError', {
      requestId: failedId,
      message: 'stale failure',
      code: 'ERR_INFER',
    });
    native.finish('done', 'done');
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: 'final', text: 'done' });
    expect(native.listenerCount).toBe(0);
    pipe.close();
  });

  it('retires an active stream on close and permits a new owner after init', async () => {
    const native = createNativeFixture();
    const owner = new LlmPipe(native);
    const next = new LlmPipe(native);
    const events: unknown[] = [];
    const lifecycle: unknown[] = [];
    owner.subscribeAsyncLifecycle((event) => lifecycle.push(event));
    await owner.init(config);
    await owner.generateAsync({ prompt: 'first' }, {
      onEvent: (event) => events.push(event),
    });
    const retiredId = native.requestId();

    owner.close();
    expect(lifecycle).toEqual([{ type: 'closed' }]);
    expect(native.listenerCount).toBe(0);
    expect(events).toEqual([]);

    await next.init(config);
    await next.generateAsync({ prompt: 'next' }, {
      onEvent: (event) => events.push(event),
    });
    native.emit('onCancelled', { requestId: retiredId });
    native.emit('onFinalResult', { requestId: retiredId, text: 'stale' });
    native.finish('next', 'next');
    expect(events).toEqual([{ type: 'final', text: 'next' }]);
    expect(native.listenerCount).toBe(0);
    next.close();
  });
});
