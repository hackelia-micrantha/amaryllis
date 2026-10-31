import { ContextPolicyUnsupportedError } from '@micrantha/amaryllis';
import type { ContextItem } from '@micrantha/amaryllis/context';
import { createMemoryStore } from '../ContextMemoryStore';

const now = Date.now();
const item = (id: string, createdAt: number): ContextItem => ({
  id,
  text: 'memory',
  createdAt,
});

describe('example ContextStore policy contract', () => {
  it('enforces maxItems and recency eviction in the same successful write', async () => {
    const store = createMemoryStore();
    const policy = { maxItems: 2, evictionStrategy: 'recency' } as const;
    await store.put(
      [item('old', now - 100), item('middle', now - 50), item('new', now)],
      policy
    );
    const result = await store.query({ text: 'memory' });
    expect(result.map((entry) => entry.id)).toEqual(['new', 'middle']);
    await expect(store.stats()).resolves.toEqual({ itemCount: 2 });
  });

  it('never returns TTL-expired records and removes them on compaction', async () => {
    const store = createMemoryStore();
    await store.put(
      [
        { ...item('expired', now - 60_000), ttlSeconds: 1 },
        { ...item('live', now), ttlSeconds: 60 },
      ],
      {}
    );

    const results = await store.query({ text: 'memory' });
    expect(results.map((entry) => entry.id)).toEqual(['live']);
    await store.compact({});
    await expect(store.stats()).resolves.toEqual({ itemCount: 1 });
  });

  it('rejects unsupported maxBytes atomically with a typed error', async () => {
    const store = createMemoryStore();
    await store.put([item('baseline', now)], { maxItems: 10 });
    await expect(
      store.put([item('new', now)], { maxBytes: 128 })
    ).rejects.toBeInstanceOf(ContextPolicyUnsupportedError);
    expect((await store.query({ text: 'memory' })).map((x) => x.id)).toEqual([
      'baseline',
    ]);
  });

  it('rejects unsupported eviction strategies rather than ignoring them', async () => {
    const store = createMemoryStore();
    await expect(
      store.put([item('new', now)], { evictionStrategy: 'lru', maxItems: 1 })
    ).rejects.toBeInstanceOf(ContextPolicyUnsupportedError);
    await expect(store.stats()).resolves.toEqual({ itemCount: 0 });
  });

  it('applies tightened limits during compact without prior stats admission', async () => {
    const store = createMemoryStore();
    await store.put([item('old', now - 20), item('new', now)], {});
    await store.compact({ maxItems: 1, evictionStrategy: 'recency' });
    expect((await store.query({ text: 'memory' })).map((x) => x.id)).toEqual([
      'new',
    ]);
  });
});
