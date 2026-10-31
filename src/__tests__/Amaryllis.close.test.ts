import { LlmPipe } from '../Amaryllis';
import type {
  LlmEventEmitter,
  LlmEventSubscription,
  LlmNativeEngine,
} from '../Types';
import { GENERATION_IN_PROGRESS_CODE } from '../Errors';

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

  it('preserves a generation failure when deferred close also fails', async () => {
    const generationError = new Error('generation failed');
    const closeError = new Error('close failed');
    let rejectGeneration: ((reason?: unknown) => void) | undefined;
    const nativeModule = {
      init: jest.fn(),
      newSession: jest.fn(),
      generate: jest.fn(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectGeneration = reject;
          })
      ),
      generateAsync: jest.fn(),
      close: jest.fn(() => {
        throw closeError;
      }),
      cancelAsync: jest.fn(),
    } as unknown as LlmNativeEngine;
    const pipe = new LlmPipe({ nativeModule, eventEmitter });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const generation = pipe.generate({ prompt: 'test' });
    await Promise.resolve();

    pipe.close();
    rejectGeneration?.(generationError);

    await expect(generation).rejects.toBe(generationError);
    expect(nativeModule.close).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to close after generation failure:',
      closeError
    );

    warnSpy.mockRestore();
  });

  it('keeps async ownership until native close returns', async () => {
    let overlapDuringClose: Promise<void> | undefined;
    const nativeModule = {
      init: jest.fn(),
      newSession: jest.fn(),
      generate: jest.fn(),
      generateAsync: jest.fn(() => Promise.resolve()),
      cancelAsync: jest.fn(),
      close: jest.fn(),
    } as unknown as LlmNativeEngine;
    const owner = new LlmPipe({ nativeModule, eventEmitter });
    const contender = new LlmPipe({ nativeModule, eventEmitter });
    const lifecycle = jest.fn();
    owner.subscribeAsyncLifecycle(lifecycle);

    (nativeModule.close as jest.Mock).mockImplementationOnce(() => {
      overlapDuringClose = contender.generateAsync({ prompt: 'blocked' });
    });

    await owner.generateAsync({ prompt: 'active' });
    owner.close();

    expect(nativeModule.cancelAsync).toHaveBeenCalledTimes(1);
    expect(nativeModule.close).toHaveBeenCalledTimes(1);
    await expect(overlapDuringClose).rejects.toMatchObject({
      code: GENERATION_IN_PROGRESS_CODE,
    });
    expect(lifecycle).toHaveBeenCalledTimes(1);
    expect(lifecycle).toHaveBeenCalledWith({ type: 'closed' });

    await expect(
      contender.generateAsync({ prompt: 'after-close' })
    ).resolves.toBeUndefined();
  });

  it('retains async ownership when native close throws', async () => {
    const closeError = new Error('native close failed');
    const nativeModule = {
      init: jest.fn(),
      newSession: jest.fn(),
      generate: jest.fn(),
      generateAsync: jest.fn(() => Promise.resolve()),
      cancelAsync: jest.fn(),
      close: jest.fn(() => {
        throw closeError;
      }),
    } as unknown as LlmNativeEngine;
    const owner = new LlmPipe({ nativeModule, eventEmitter });
    const contender = new LlmPipe({ nativeModule, eventEmitter });
    const lifecycle = jest.fn();
    owner.subscribeAsyncLifecycle(lifecycle);

    await owner.generateAsync({ prompt: 'active' });

    expect(() => owner.close()).toThrow(closeError);
    expect(lifecycle).not.toHaveBeenCalled();
    await expect(
      contender.generateAsync({ prompt: 'blocked' })
    ).rejects.toMatchObject({
      code: GENERATION_IN_PROGRESS_CODE,
    });
  });
});
