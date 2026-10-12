import { ContextEngine } from '../ContextEngine';
import type {
  ContextItem,
  ContextPolicy,
  ContextStore,
} from '../ContextTypes';
import { ValidationError } from '../Errors';

const createStore = (): ContextStore => ({
  put: jest.fn(async (_items: ContextItem[], _policy: ContextPolicy) => {}),
  query: jest.fn(async () => []),
  delete: jest.fn(async () => {}),
  compact: jest.fn(async () => {}),
  stats: jest.fn(async () => ({ itemCount: 0 })),
});

const item = (overrides: Partial<ContextItem> = {}): ContextItem => ({
  id: 'note',
  text: 'memory',
  createdAt: Date.now(),
  ...overrides,
});

describe('ContextPolicy enforcement ownership', () => {
  it('passes the explicit empty effective policy on every unbounded write', async () => {
    const store = createStore();
    const engine = new ContextEngine({ store });
    const source = item();

    await engine.add([source]);

    expect(store.put).toHaveBeenCalledWith([source], {});
    expect(store.stats).not.toHaveBeenCalled();
  });

  it('materializes default TTL without mutating source items or overriding an explicit TTL', async () => {
    const store = createStore();
    const policy: ContextPolicy = { defaultTtlSeconds: 90, maxItems: 10 };
    const engine = new ContextEngine({ store, policy });
    const withoutTtl = item({ id: 'default' });
    const withTtl = item({ id: 'explicit', ttlSeconds: 15 });

    await engine.add([withoutTtl, withTtl]);

    expect(store.put).toHaveBeenCalledWith(
      [
        { ...withoutTtl, ttlSeconds: 90 },
        { ...withTtl, ttlSeconds: 15 },
      ],
      policy
    );
    expect(withoutTtl.ttlSeconds).toBeUndefined();
    expect(withTtl.ttlSeconds).toBe(15);
  });

  it('applies changed policy to subsequent writes and compaction, not stored TTLs', async () => {
    const store = createStore();
    const engine = new ContextEngine({
      store,
      policy: { defaultTtlSeconds: 30, maxItems: 8 },
    });
    const first = item({ id: 'first' });
    await engine.add([first]);
    const nextPolicy: ContextPolicy = { defaultTtlSeconds: 5, maxItems: 2 };
    engine.setPolicy(nextPolicy);
    const second = item({ id: 'second' });
    await engine.add([second]);
    await engine.compact();

    expect(store.put).toHaveBeenNthCalledWith(
      1,
      [{ ...first, ttlSeconds: 30 }],
      { defaultTtlSeconds: 30, maxItems: 8 }
    );
    expect(store.put).toHaveBeenNthCalledWith(
      2,
      [{ ...second, ttlSeconds: 5 }],
      nextPolicy
    );
    expect(store.compact).toHaveBeenCalledWith(nextPolicy);
  });

  it('rejects invalid input and media before calling the store', async () => {
    const store = createStore();
    const engine = new ContextEngine({
      store,
      policy: { media: { maxMediaBytes: 512 } },
    });

    await expect(
      engine.add([item({ media: [{ uri: 'file:///image', sizeBytes: 1024 }] })])
    ).rejects.toBeInstanceOf(ValidationError);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('revalidates retrieved storage content before using it as model context', async () => {
    const store = createStore();
    store.query = jest.fn(async () => [
      item({ media: [{ uri: 'file:///unsafe', sizeBytes: 4096 }] }),
    ]);
    const engine = new ContextEngine({
      store,
      policy: { media: { maxMediaBytes: 1000 } },
    });

    await expect(engine.search({ text: 'memory' })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(store.stats).not.toHaveBeenCalled();
  });
});
