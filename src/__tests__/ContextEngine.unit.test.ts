import {
  ContextEngine,
  defaultContextFormatter,
  createContextEngine,
} from '../ContextEngine';
import type {
  ContextEngine as ContextEngineContract,
  ContextItem,
  ContextQuery,
  ContextStore,
} from '../ContextTypes';

const createStore = (): ContextStore => ({
  put: jest.fn(() => Promise.resolve()),
  query: jest.fn(() => Promise.resolve([])),
  delete: jest.fn(() => Promise.resolve()),
  compact: jest.fn(() => Promise.resolve()),
  stats: jest.fn(() => Promise.resolve({ itemCount: 0 })),
});

describe('ContextEngine unit behavior', () => {
  it('should leave request untouched when there is no context', () => {
    const request = {
      prompt: 'hello world',
      images: ['file:///tmp/example.png'],
    };

    expect(
      defaultContextFormatter({
        prompt: request.prompt,
        items: [],
        request,
      })
    ).toBe(request);
  });

  it('should format tags and metadata into the prompt context block', () => {
    const item: ContextItem = {
      id: 'note-1',
      text: '  Saved fact  ',
      tags: ['user', 'memory'],
      metadata: { source: 'chat', priority: 'high' },
      createdAt: 1,
    };

    expect(
      defaultContextFormatter({
        prompt: 'What do you know?',
        items: [item],
        request: { prompt: 'What do you know?' },
      })
    ).toEqual({
      prompt:
        'Context:\n- Saved fact | tags=user, memory | meta=source=chat, priority=high\n\nWhat do you know?',
    });
  });

  it('should preserve store order when scores tie', async () => {
    const items: ContextItem[] = [
      { id: 'first', text: 'same', createdAt: 1 },
      { id: 'second', text: 'same', createdAt: 1 },
    ];
    const store = createStore();
    store.query = jest.fn(async () => items);
    const engine = new ContextEngine({
      store,
      scorer: { score: () => 1 },
    });

    await expect(engine.search({ text: 'same' })).resolves.toEqual(items);
  });

  it('should return deriveQuery output when a default query factory exists', () => {
    const query: ContextQuery = { text: 'derived', limit: 2 };
    const request = { prompt: 'hello' };
    const engine: ContextEngineContract = createContextEngine({
      store: createStore(),
      defaultQueryFactory: (prompt, nextRequest) => {
        expect(prompt).toBe('hello');
        expect(nextRequest).toBe(request);
        return query;
      },
    });

    expect(engine.deriveQuery('hello', request)).toEqual(query);
  });

  it('should return undefined when no default query factory is configured', () => {
    const engine = new ContextEngine({ store: createStore() });

    expect(engine.deriveQuery('hello', { prompt: 'hello' })).toBeUndefined();
  });
});
