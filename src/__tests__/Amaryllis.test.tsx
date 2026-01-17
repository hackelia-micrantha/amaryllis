import type {
  LlmEngineConfig,
  LlmSessionParams,
  LlmRequestParams,
  LlmCallbacks,
  LlmEventSubscription,
} from '../Types';
import { LlmPipe } from '../Amaryllis';

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

const pipe = new LlmPipe({
  nativeModule: nativeMock,
  eventEmitter: emitterMock,
});

describe('LlmPipe', () => {
  const config: LlmEngineConfig = { modelPath: 'foo' } as LlmEngineConfig;
  const sessionParams: LlmSessionParams = {
    randomSeed: 12345,
  } as LlmSessionParams;
  const requestParams: LlmRequestParams = { prompt: 'baz' } as LlmRequestParams;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key in listeners) {
      delete listeners[key];
    }
    listeners = {};
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

  it('calls native generateAsync and manages listeners', async () => {
    const onEvent = jest.fn();
    const callbacks: LlmCallbacks = { onEvent };
    await pipe.generateAsync(requestParams, callbacks);
    expect(nativeMock.generateAsync).toHaveBeenCalledWith(requestParams);
    // Listeners should be added
    expect(listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_FINAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_ERROR]).toBeDefined();

    // Simulate partial result event
    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial');
    expect(onEvent).toHaveBeenCalledWith({ type: 'partial', text: 'partial' });
    // Should not remove listeners on partial
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();

    // Simulate final result event
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('final');
    expect(onEvent).toHaveBeenCalledWith({ type: 'final', text: 'final' });
    // Should remove listeners and call cancelAsync
    expect(nativeMock.cancelAsync).toHaveBeenCalled();
    expect(nativeMock.cancelAsync).toHaveBeenCalledTimes(1);
  });

  it('calls native generateAsync and handles error listener', async () => {
    const onEvent = jest.fn();
    const callbacks: LlmCallbacks = { onEvent };
    await pipe.generateAsync(requestParams, callbacks);
    expect(nativeMock.generateAsync).toHaveBeenCalledWith(requestParams);
    // Listeners should be added
    expect(listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_FINAL_RESULT]).toBeDefined();
    expect(listeners[nativeMock.EVENT_ON_ERROR]).toBeDefined();

    // Simulate partial result event
    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial');
    expect(onEvent).toHaveBeenCalledWith({ type: 'partial', text: 'partial' });
    // Should not remove listeners on partial
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();

    // Simulate error event
    listeners[nativeMock.EVENT_ON_ERROR]?.('error');
    expect(onEvent).toHaveBeenCalledWith({
      type: 'error',
      error: expect.any(Error),
    });
    expect(nativeMock.cancelAsync).toHaveBeenCalledTimes(1);
  });

  it('removes listeners only on final or error, not on partial', async () => {
    const onEvent = jest.fn();
    const callbacks: LlmCallbacks = { onEvent };
    await pipe.generateAsync(requestParams, callbacks);
    // Simulate multiple partial events
    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial1');
    listeners[nativeMock.EVENT_ON_PARTIAL_RESULT]?.('partial2');
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(nativeMock.cancelAsync).not.toHaveBeenCalled();
    // Simulate final event
    listeners[nativeMock.EVENT_ON_FINAL_RESULT]?.('final');
    expect(onEvent).toHaveBeenCalledWith({ type: 'final', text: 'final' });
    expect(nativeMock.cancelAsync).toHaveBeenCalled();
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
