import { LlmPipe } from '../Amaryllis';
import type {
  LlmEventEmitter,
  LlmEventSubscription,
  LlmNativeEngine,
} from '../Types';

const eventEmitter: LlmEventEmitter = {
  addListener: (): LlmEventSubscription => ({ remove: jest.fn() }),
};

describe('LlmPipe close ownership', () => {
  it('defers an owner close until synchronous generation settles', async () => {
    let resolveGeneration: ((value: string) => void) | undefined;
    const nativeModule = {
      init: jest.fn(),
      newSession: jest.fn(),
      generate: jest.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveGeneration = resolve;
          })
      ),
      generateAsync: jest.fn(),
      close: jest.fn(),
      cancelAsync: jest.fn(),
    } as unknown as LlmNativeEngine;
    const pipe = new LlmPipe({ nativeModule, eventEmitter });

    const generation = pipe.generate({ prompt: 'test' });
    await Promise.resolve();

    pipe.close();
    expect(nativeModule.close).not.toHaveBeenCalled();

    resolveGeneration?.('done');
    await expect(generation).resolves.toBe('done');
    expect(nativeModule.close).toHaveBeenCalledTimes(1);
  });

  it('notifies lifecycle before removing native listeners on cancelAsync', async () => {
    const callOrder: string[] = [];
    const nativeModule = {
      init: jest.fn(),
      newSession: jest.fn(),
      generate: jest.fn(),
      generateAsync: jest.fn(async () => {}),
      close: jest.fn(() => callOrder.push('close')),
      cancelAsync: jest.fn(() => callOrder.push('cancelAsync')),
    } as unknown as LlmNativeEngine;

    const trackingEmitter: LlmEventEmitter = {
      addListener: () => ({
        remove: () => {
          callOrder.push('removeListener');
        },
      }),
    };

    const pipe = new LlmPipe({ nativeModule, eventEmitter: trackingEmitter });
    const lifecycleListener = jest.fn(() => callOrder.push('lifecycle'));
    pipe.subscribeAsyncLifecycle(lifecycleListener);

    await pipe.generateAsync({ prompt: 'test' });

    pipe.cancelAsync();

    expect(lifecycleListener).toHaveBeenCalledWith({ type: 'cancelled' });
    const lifecycleIdx = callOrder.indexOf('lifecycle');
    const removeIdx = callOrder.indexOf('removeListener');
    expect(lifecycleIdx).toBeGreaterThanOrEqual(0);
    expect(removeIdx).toBeGreaterThanOrEqual(0);
    expect(lifecycleIdx).toBeLessThan(removeIdx);
  });

  it('prevents non-owner close even with no active operation', async () => {
    const closeListeners: Record<string, (result: string) => void> = {};
    const trackingEmitter: LlmEventEmitter = {
      addListener: (event: string, cb: (result: any) => void) => {
        closeListeners[event] = cb;
        return {
          remove: () => {
            delete closeListeners[event];
          },
        };
      },
    };

    const nativeModule = {
      init: jest.fn(),
      newSession: jest.fn(),
      generate: jest.fn(),
      generateAsync: jest.fn(async () => {}),
      close: jest.fn(),
      cancelAsync: jest.fn(),
    } as unknown as LlmNativeEngine;

    const owner = new LlmPipe({ nativeModule, eventEmitter: trackingEmitter });
    const stranger = new LlmPipe({
      nativeModule,
      eventEmitter: trackingEmitter,
    });

    await owner.generateAsync({ prompt: 'first' });

    stranger.close();

    expect(nativeModule.close).not.toHaveBeenCalled();
    expect(nativeModule.cancelAsync).not.toHaveBeenCalled();

    closeListeners.onFinalResult?.('done');
  });
});
