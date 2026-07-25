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

let listeners: Record<string, (result: string) => void> = {};

const nativeMock = {
  init: jest.fn(),
  newSession: jest.fn(),
  generate: jest.fn<Promise<string>, [LlmRequestParams]>(),
  generateAsync: jest.fn<Promise<null>, [LlmRequestParams]>(),
  close: jest.fn(),
  cancelAsync: jest.fn(),
  EVENT_ON_PARTIAL_RESULT: 'onPartialResult',
  EVENT_ON_FINAL_RESULT: 'onFinalResult',
  EVENT_ON_ERROR: 'onError',
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

describe('LlmPipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nativeMock.generate.mockResolvedValue('result');
    nativeMock.generateAsync.mockResolvedValue(null);
    listeners = {};
    pipe = new LlmPipe({
      nativeModule: nativeMock,
      eventEmitter: emitterMock,
    });
  });

  afterEach(() => {
    pipe.cancelAsync();
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
    expect(nativeMock.generateAsync).toHaveBeenCalledWith(requestParams);
    expect(listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_FINAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_ERROR]).toBeDefined();

    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial');
    expect(onEvent).toHaveBeenCalledWith({ type: 'partial', text: 'partial' });
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();

    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('final');
    expect(onEvent).toHaveBeenCalledWith({ type: 'final', text: 'final' });
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();
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

    await expect(pipe.generate({ prompt: 'sync overlap' })).rejects.toMatchObject(
      { code: GENERATION_IN_PROGRESS_CODE }
    );
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

  it('notifies lifecycle observers when active work is cancelled externally', async () => {
    const lifecycleListener = jest.fn();
    pipe.subscribeAsyncLifecycle(lifecycleListener);
    await pipe.generateAsync(requestParams, { onEvent: jest.fn() });

    pipe.cancelAsync();

    expect(nativeMock.cancelAsync).toHaveBeenCalledTimes(1);
    expect(lifecycleListener).toHaveBeenCalledWith({ type: 'cancelled' });
  });

  it('cancels only the active generation and ignores its late events', async () => {
    const firstOnEvent = jest.fn();
    const secondOnEvent = jest.fn();

    await pipe.generateAsync(requestParams, { onEvent: firstOnEvent });
    const staleFinalListener = listeners[nativeMock.EVENT_ON_FINAL_RESULT];

    pipe.cancelAsync();

    expect(nativeMock.cancelAsync).toHaveBeenCalledTimes(1);
    expect(listeners).toEqual({});

    await pipe.generateAsync({ prompt: 'second' }, { onEvent: secondOnEvent });
    staleFinalListener?.('late-first');

    expect(firstOnEvent).not.toHaveBeenCalled();
    expect(secondOnEvent).not.toHaveBeenCalled();

    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('second');
    expect(secondOnEvent).toHaveBeenCalledWith({
      type: 'final',
      text: 'second',
    });
  });

  it('installs terminal listeners when callbacks are omitted', async () => {
    await pipe.generateAsync(requestParams);

    expect(listeners[nativeMock.EVENT_ON_FINAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_ERROR]).toBeDefined();

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
