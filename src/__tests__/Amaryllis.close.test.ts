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
});
