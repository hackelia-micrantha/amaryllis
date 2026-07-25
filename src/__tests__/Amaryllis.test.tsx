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
  generate: jest.fn().mockResolvedValue('result'),
  generateAsync: jest.fn().mockResolvedValue(null),
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
