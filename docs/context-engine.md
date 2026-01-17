# Context Engine (Interface-First)

The Context Engine is a lightweight, offline-first facade that wires validation, scoring, and storage without bundling any backend. You provide a `ContextStore` implementation that fits your app (SQLite, files, or custom DB). The engine enforces policy bounds and media constraints before it touches your store.

## Concepts

- **ContextItem**: a unit of memory (text + metadata + optional media references)
- **ContextPolicy**: limits and eviction guidance for stores
- **ContextStore**: the storage interface your app implements
- **ContextScorer**: optional ranking used after querying

## Basic Usage

```ts
import {
  ContextEngine,
  defaultContextScorer,
  type ContextStore,
  type ContextItem,
} from 'react-native-amaryllis/context';

const store: ContextStore = {
  async put(items: ContextItem[]) {
    // Persist items in your storage backend.
  },
  async query(query) {
    // Return candidate items matching query filters.
    return [];
  },
  async delete(ids) {
    // Optional cleanup.
  },
  async compact(policy) {
    // Enforce eviction/TTL policy in your store.
  },
  async stats() {
    return { itemCount: 0 };
  },
};

const engine = new ContextEngine({
  store,
  scorer: defaultContextScorer,
  policy: {
    maxItems: 1000,
    defaultTtlSeconds: 60 * 60 * 24,
    media: {
      requireAbsoluteUri: true,
      allowedUriSchemes: ['file', 'content'],
      maxMediaBytes: 5 * 1024 * 1024,
    },
  },
  defaultQueryFactory: (prompt) => ({ text: prompt, limit: 6 }),
});

await engine.add([
  {
    id: 'mem-1',
    text: 'Player found the emerald key.',
    tags: ['game', 'state'],
    createdAt: Date.now(),
    media: [{ uri: 'file:///path/to/image.png', sizeBytes: 1024 }],
  },
]);

const results = await engine.search({ text: 'emerald key', limit: 5 });
```

## Hooks Integration

Wrap your app with `ContextEngineProvider`, then use context-aware hooks
to auto-augment prompts with retrieved context.

```tsx
import {
  ContextEngineProvider,
  createContextEngine,
  useContextInferenceAsync,
} from 'react-native-amaryllis/context';
import { LLMProvider } from 'react-native-amaryllis';

const engine = createContextEngine({
  store,
  defaultQueryFactory: (prompt) => ({ text: prompt, limit: 6 }),
});

const Component = () => {
  const generate = useContextInferenceAsync({
    onResult: (text, isFinal) => {
      if (isFinal) {
        console.log(text);
      }
    },
  });

  return <Button onPress={() => generate({ prompt: 'hello' })} />;
};

export const App = () => (
  <LLMProvider config={config}>
    <ContextEngineProvider engine={engine}>
      <Component />
    </ContextEngineProvider>
  </LLMProvider>
);
```

## Formatters

Formatters control how context is injected into the request. The default
formatter adds a "Context:" block above the prompt. You can supply your
own formatter to inject system prompts or other structure.

```ts
const engine = new ContextEngine({
  store,
  formatter: ({ prompt, items, request }) => ({
    ...request,
    prompt: [
      'System: Use the memory below.',
      'Context:',
      ...items.map((item) => `- ${item.text}`),
      prompt,
    ].join('\\n'),
  }),
});
```

## Validation Helpers

Use validation helpers if you want to enforce constraints before calling the engine:

```ts
import {
  validateContextItems,
  validateContextPolicy,
  validateContextQuery,
} from 'react-native-amaryllis';

validateContextPolicy(policy);
validateContextItems(items, policy);
validateContextQuery({ text: 'quest hints', limit: 10 });
```

## Media References

Media is represented as references only; the SDK does not load or decode files. Use policy limits to avoid excessive storage or large media.

```ts
type MediaReference = {
  uri: string; // absolute path or URI
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
};
```

## Storage Expectations

Your `ContextStore` should:
- honor `ContextPolicy` in `compact()`
- apply TTL and eviction strategies as appropriate
- return results ordered if you want to override scoring

If your store does not order results, the engine can apply a `ContextScorer` to rank them.

## Common Use Cases

- **Chat assistants**: store session memory plus episodic memories with TTL.
- **Games**: store world state and narrative facts, with tags for fast filtering.

## Notes

- No bundled vector DB. Semantic search is optional and up to your store and scorer.
- No on-device MCP server. Use tool interfaces or a bridge outside mobile if needed.
