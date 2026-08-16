import type {
  LlmEngineConfig,
  LlmSessionParams,
  LlmRequestParams,
  LlmCallbacks,
  LlmEventSubscription,
} from '../Types';
import { LlmPipe } from '../Amaryllis';
import {
  GENERATION_IN_PROGRESS_CODE,
  GenerationInProgressError,
} from '../Errors';

let listeners: Record<string, (result: any) => void> = {};

const nativeMock = {
  init: jest.fn(),
  newSession: jest.fn(),
  generate: jest.fn<Promise<string>, [LlmRequestParams]>(),
  generateAsync: jest.fn<Promise<void>, [LlmRequestParams, string]>(),
  close: jest.fn(),
  cancelAsync: jest.fn<void, [string]>(),
  EVENT_ON_PARTIAL_RESULT: 'onPartialResult',
  EVENT_ON_FINAL_RESULT: 'onFinalResult',
  EVENT_ON_ERROR: 'onError',
  EVENT_ON_CANCELLED: 'onCancelled',
};

const emitterMock = {
  addListener: (
    event: string,
    cb: (result: any) => void
  ): LlmEventSubscription => {
    listeners[event] = cb;
    return {
      remove: () => {
        delete listeners[event];
      },
    };
  },
};

let pipe: LlmPipe;

const config: LlmEngineConfig = { modelPath: 'foo' } as LlmEngineConfig;
const sessionParams: LlmSessionParams = {
  randomSeed: 12345,
} as LlmSessionParams;
const requestParams: LlmRequestParams = { prompt: 'baz' } as LlmRequestParams;

const getLastRequestId = (): string => {
  const call = nativeMock.generateAsync.mock.calls.at(-1);
  if (!call) {
    throw new Error('Expected an asynchronous native generation call');
  }
  return call[1];
};

const emitCancelled = (requestId: string) => {
  listeners[nativeMock.EVENT_ON_CANCELLED]?.({ requestId });
};

describe('LlmPipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nativeMock.generate.mockResolvedValue('result');
    nativeMock.generateAsync.mockResolvedValue(undefined);
    nativeMock.cancelAsync.mockImplementation(() => {});
    nativeMock.close.mockImplementation(() => {});
    listeners = {};
    pipe = new LlmPipe({
      nativeModule: nativeMock,
      eventEmitter: emitterMock,
    });
  });

  afterEach(() => {
    try {
      pipe.close();
    } catch {
      // Individual close-failure tests intentionally leave the native mock throwing.
    }
  });

  it('calls native init', async () => {
    await pipe.init(config);
    expect(nativeMock.init).toHaveBeenCalledWith(config);
  });

  it('calls native newSession', async () => {
    await pipe.newSession(sessionParams);
    expect(nativeMock.newSession).toHaveBeenCalledWith(sessionParams);
  });

  it('calls native generateSync', async () => {
    const result = await pipe.generate(requestParams);
    expect(nativeMock.generate).toHaveBeenCalledWith(requestParams);
    expect(result).toBe('result');
  });

  it('calls native generateAsync and releases listeners on final', async () => {
    const onEvent = jest.fn();
    const callbacks: LlmCallbacks = { onEvent };
    await pipe.generateAsync(requestParams, callbacks);
    expect(nativeMock.generateAsync).toHaveBeenCalledWith(
      requestParams,
      expect.any(String)
    );
    expect(listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_FINAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_ERROR]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_CANCELLED]).toBeDefined();

    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial');
    expect(onEvent).toHaveBeenCalledWith({ type: 'partial', text: 'partial' });
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();

    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('final');
    expect(onEvent).toHaveBeenCalledWith({ type: 'final', text: 'final' });
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();
    expect(listeners).toEqual({});
  });

  it('routes structured native events only to their request', async () => {
    const onEvent = jest.fn();
    await pipe.generateAsync(requestParams, { onEvent });
    const requestId = getLastRequestId();

    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.({
      requestId: 'another-request',
      text: 'stale',
    });
    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.({
      requestId,
      text: 'partial',
    });
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.({
      requestId,
      text: '',
    });

    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: 'partial',
      text: 'partial',
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: 'final',
      text: '',
    });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(listeners).toEqual({});
  });

  it('preserves a final snapshot for final-only callbacks', async () => {
    const onFinalResult = jest.fn();
    await pipe.generateAsync(requestParams, { onFinalResult });
    const requestId = getLastRequestId();

    expect(listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]).toBeUndefined();
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.({
      requestId,
      text: '',
      finalText: 'complete result',
    });

    expect(onFinalResult).toHaveBeenCalledWith('complete result');
    expect(listeners).toEqual({});
  });

  it('releases listeners on an async error without cancelling completed work', async () => {
    const onEvent = jest.fn();
    const callbacks: LlmCallbacks = { onEvent };
    await pipe.generateAsync(requestParams, callbacks);

    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial');
    listeners[nativeMock.EVENT_ON_ERROR]?.('error');

    expect(onEvent).toHaveBeenCalledWith({
      type: 'error',
      error: expect.any(Error),
    });
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();
    expect(listeners).toEqual({});
  });

  it('supports sequential async generations', async () => {
    const firstOnEvent = jest.fn();
    const secondOnEvent = jest.fn();

    await pipe.generateAsync(requestParams, { onEvent: firstOnEvent });
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('first');

    await pipe.generateAsync({ prompt: 'second' }, { onEvent: secondOnEvent });
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('second');

    expect(nativeMock.generateAsync).toHaveBeenCalledTimes(2);
    expect(firstOnEvent).toHaveBeenCalledWith({
      type: 'final',
      text: 'first',
    });
    expect(secondOnEvent).toHaveBeenCalledWith({
      type: 'final',
      text: 'second',
    });
  });

  it('releases the lock before terminal callbacks run', async () => {
    const secondOnEvent = jest.fn();
    let secondGeneration: Promise<void> | undefined;

    await pipe.generateAsync(requestParams, {
      onFinalResult: () => {
        secondGeneration = pipe.generateAsync(
          { prompt: 'second' },
          { onEvent: secondOnEvent }
        );
      },
    });

    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('first');

    expect(secondGeneration).toBeDefined();
    await secondGeneration;
    expect(nativeMock.generateAsync).toHaveBeenCalledTimes(2);

    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('second');
    expect(secondOnEvent).toHaveBeenCalledWith({
      type: 'final',
      text: 'second',
    });
  });

  it('rejects overlapping async generations', async () => {
    await pipe.generateAsync(requestParams, { onEvent: jest.fn() });

    await expect(
      pipe.generateAsync({ prompt: 'overlap' }, { onEvent: jest.fn() })
    ).rejects.toEqual(expect.any(GenerationInProgressError));
    await expect(
      pipe.generateAsync({ prompt: 'overlap' }, { onEvent: jest.fn() })
    ).rejects.toMatchObject({ code: GENERATION_IN_PROGRESS_CODE });

    expect(nativeMock.generateAsync).toHaveBeenCalledTimes(1);
  });

  it('rejects synchronous generation while async work is active', async () => {
    await pipe.generateAsync(requestParams, { onEvent: jest.fn() });

    await expect(
      pipe.generate({ prompt: 'sync overlap' })
    ).rejects.toMatchObject({ code: GENERATION_IN_PROGRESS_CODE });
    expect(nativeMock.generate).not.toHaveBeenCalled();
  });

  it('rejects async generation while synchronous work is active', async () => {
    let resolveSync: ((result: string) => void) | undefined;
    nativeMock.generate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveSync = resolve;
        })
    );

    const syncGeneration = pipe.generate(requestParams);
    await Promise.resolve();

    await expect(
      pipe.generateAsync({ prompt: 'async overlap' }, { onEvent: jest.fn() })
    ).rejects.toMatchObject({ code: GENERATION_IN_PROGRESS_CODE });
    expect(nativeMock.generateAsync).not.toHaveBeenCalled();

    resolveSync?.('sync result');
    await expect(syncGeneration).resolves.toBe('sync result');
  });

  it('rejects overlap across pipes that share one native module', async () => {
    const secondPipe = new LlmPipe({
      nativeModule: nativeMock,
      eventEmitter: emitterMock,
    });
    await pipe.generateAsync(requestParams, { onEvent: jest.fn() });

    await expect(
      secondPipe.generateAsync({ prompt: 'overlap' }, { onEvent: jest.fn() })
    ).rejects.toMatchObject({ code: GENERATION_IN_PROGRESS_CODE });

    expect(nativeMock.generateAsync).toHaveBeenCalledTimes(1);
  });

  it('does not let a non-owner close shared active work', async () => {
    const ownerOnEvent = jest.fn();
    const secondPipe = new LlmPipe({
      nativeModule: nativeMock,
      eventEmitter: emitterMock,
    });
    await pipe.generateAsync(requestParams, { onEvent: ownerOnEvent });

    secondPipe.close();

    expect(nativeMock.close).not.toHaveBeenCalled();
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('owner final');
    expect(ownerOnEvent).toHaveBeenCalledWith({
      type: 'final',
      text: 'owner final',
    });
  });

  it('keeps cancellation non-terminal until native confirms it', async () => {
    const lifecycleListener = jest.fn();
    pipe.subscribeAsyncLifecycle(lifecycleListener);
    await pipe.generateAsync(requestParams, { onEvent: jest.fn() });
    const requestId = getLastRequestId();

    pipe.cancelAsync();

    expect(nativeMock.cancelAsync).toHaveBeenCalledWith(requestId);
    expect(lifecycleListener).not.toHaveBeenCalled();
    expect(listeners[nativeMock.EVENT_ON_CANCELLED]).toBeDefined();
    await expect(
      pipe.generateAsync({ prompt: 'blocked' }, { onEvent: jest.fn() })
    ).rejects.toMatchObject({ code: GENERATION_IN_PROGRESS_CODE });

    emitCancelled(requestId);

    expect(lifecycleListener).toHaveBeenCalledTimes(1);
    expect(lifecycleListener).toHaveBeenCalledWith({ type: 'cancelled' });
    expect(listeners).toEqual({});
    await expect(pipe.generateAsync({ prompt: 'next' })).resolves.toBeUndefined();
  });

  it('makes repeated cancellation requests idempotent while cancelling', async () => {
    await pipe.generateAsync(requestParams);
    const requestId = getLastRequestId();

    pipe.cancelAsync();
    pipe.cancelAsync();

    expect(nativeMock.cancelAsync).toHaveBeenCalledTimes(1);
    expect(nativeMock.cancelAsync).toHaveBeenCalledWith(requestId);
    emitCancelled(requestId);
  });

  it('restores generation ownership when native cancellation throws synchronously', async () => {
    const cancelError = new Error('cancel failed');
    const lifecycleListener = jest.fn();
    const onEvent = jest.fn();
    pipe.subscribeAsyncLifecycle(lifecycleListener);
    nativeMock.cancelAsync.mockImplementationOnce(() => {
      throw cancelError;
    });
    await pipe.generateAsync(requestParams, { onEvent });

    expect(() => pipe.cancelAsync()).toThrow(cancelError);
    expect(lifecycleListener).not.toHaveBeenCalled();

    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('still-running');
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('done');
    expect(onEvent).toHaveBeenCalledWith({
      type: 'partial',
      text: 'still-running',
    });
    expect(onEvent).toHaveBeenCalledWith({ type: 'final', text: 'done' });
    await expect(pipe.generateAsync({ prompt: 'next' })).resolves.toBeUndefined();
  });

  it('ignores final and error events while cancellation is pending', async () => {
    const onEvent = jest.fn();
    await pipe.generateAsync(requestParams, { onEvent });
    const requestId = getLastRequestId();

    pipe.cancelAsync();
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.({ requestId, text: 'late' });
    listeners[nativeMock.EVENT_ON_ERROR]?.({
      requestId,
      message: 'late error',
    });

    expect(onEvent).not.toHaveBeenCalled();
    await expect(pipe.generateAsync({ prompt: 'blocked' })).rejects.toMatchObject({
      code: GENERATION_IN_PROGRESS_CODE,
    });

    emitCancelled(requestId);
    await expect(pipe.generateAsync({ prompt: 'next' })).resolves.toBeUndefined();
  });

  it('does not let a stale cancellation settle a newer request', async () => {
    const firstOnEvent = jest.fn();
    const secondOnEvent = jest.fn();

    await pipe.generateAsync(requestParams, { onEvent: firstOnEvent });
    const firstRequestId = getLastRequestId();
    const staleCancelledListener = listeners[nativeMock.EVENT_ON_CANCELLED];
    pipe.cancelAsync();
    emitCancelled(firstRequestId);

    await pipe.generateAsync({ prompt: 'second' }, { onEvent: secondOnEvent });
    const secondRequestId = getLastRequestId();
    staleCancelledListener?.({ requestId: firstRequestId });

    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.({
      requestId: secondRequestId,
      text: 'second-partial',
    });
    expect(secondOnEvent).toHaveBeenCalledWith({
      type: 'partial',
      text: 'second-partial',
    });

    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.({
      requestId: secondRequestId,
      text: 'second-final',
    });
    expect(secondOnEvent).toHaveBeenCalledWith({
      type: 'final',
      text: 'second-final',
    });
  });

  it('installs terminal listeners when callbacks are omitted', async () => {
    await pipe.generateAsync(requestParams);

    expect(listeners[nativeMock.EVENT_ON_FINAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_ERROR]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_CANCELLED]).toBeDefined();

    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('done');
    await expect(pipe.generateAsync(requestParams)).resolves.toBeUndefined();
  });

  it('supports deprecated callbacks', async () => {
    const onPartialResult = jest.fn();
    const onFinalResult = jest.fn();
    const onError = jest.fn();
    const callbacks: LlmCallbacks = { onPartialResult, onFinalResult, onError };
    await pipe.generateAsync(requestParams, callbacks);

    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial');
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('final');

    expect(onPartialResult).toHaveBeenCalledWith('partial');
    expect(onFinalResult).toHaveBeenCalledWith('final');

    await pipe.generateAsync(requestParams, callbacks);
    listeners[nativeMock.EVENT_ON_ERROR]?.('error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
