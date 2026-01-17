import { ContextEngine, createContextEngine } from '../ContextEngine';
import type {
  ContextItem,
  ContextPolicy,
  ContextScorer,
  ContextStore,
} from '../ContextTypes';
import { ValidationError } from '../Errors';

const createStore = (): ContextStore => ({
  put: jest.fn(() => Promise.resolve()),
  query: jest.fn(() => Promise.resolve([])),
  delete: jest.fn(() => Promise.resolve()),
  compact: jest.fn(() => Promise.resolve()),
  stats: jest.fn(() => Promise.resolve({ itemCount: 0 })),
});

describe('ContextEngine', () => {
  it('should validate items before storing', async () => {
    const store = createStore();
    const engine = new ContextEngine({ store });
    const badItem: ContextItem = {
      id: '',
      text: 'hello',
      createdAt: Date.now(),
    };

    await expect(engine.add([badItem])).rejects.toBeInstanceOf(ValidationError);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('should use policy when validating media', async () => {
    const store = createStore();
    const policy: ContextPolicy = {
      media: { requireAbsoluteUri: true },
    };
    const engine = new ContextEngine({ store, policy });
    const badItem: ContextItem = {
      id: 'item-1',
      text: 'hello',
      createdAt: Date.now(),
      media: [{ uri: 'relative/path.png' }],
    };

    await expect(engine.add([badItem])).rejects.toBeInstanceOf(ValidationError);
  });

  it('should apply scorer ordering for search results', async () => {
    const items: ContextItem[] = [
      { id: 'a', text: 'alpha', createdAt: 1 },
      { id: 'b', text: 'beta', createdAt: 1 },
    ];
    const store = createStore();
    store.query = jest.fn(() => Promise.resolve(items));
    const scorer: ContextScorer = {
      score: (item) => (item.id === 'b' ? 2 : 1),
    };

    const engine = createContextEngine({ store, scorer });
    const results = await engine.search({ text: 'query' });

    expect(results.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('should reject invalid policy bounds', () => {
    const store = createStore();
    const policy: ContextPolicy = { maxItems: 0 };
    expect(() => new ContextEngine({ store, policy })).toThrow(ValidationError);
  });

  it('should compact using current policy', async () => {
    const store = createStore();
    const policy: ContextPolicy = { maxItems: 10 };
    const engine = new ContextEngine({ store, policy });

    await engine.compact();

    expect(store.compact).toHaveBeenCalledWith(policy);
  });
});
