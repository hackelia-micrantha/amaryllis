# Context Engine (Interface-First)

The Context Engine is a lightweight, offline-first facade that wires validation, scoring, and storage without bundling any backend. You provide a `ContextStore` implementation that fits your app (SQLite, files, or custom DB). The engine validates inputs and materializes TTL defaults; the store atomically enforces persisted limits and expiry. Unsupported configured guarantees must fail explicitly.

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
import { ContextPolicyUnsupportedError } from '@micrantha/amaryllis';

// Adapter skeleton: replace with an application-owned transactional store.
// This skeleton refuses writes rather than silently ignoring configured bounds.
const store: ContextStore = {
  async put(items: ContextItem[], policy) {
    throw new ContextPolicyUnsupportedError(
      'Implement atomic persistence and policy enforcement in this adapter'
    );
  },
  async query(query) {
    // Return candidate items matching query filters.
    return [];
  },
  async delete(ids) {
    // Optional cleanup.
  },
  async compact(policy) {
    throw new ContextPolicyUnsupportedError(
      'Implement atomic eviction and TTL compaction in this adapter'
    );
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

// This call succeeds only after the application implements the adapter above.
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

## ContextStore migration and enforcement ownership

The pre-1.0 write signature changed:

```ts
// Old
put(items: ContextItem[]): Promise<void>;

// New (required, not optional)
put(items: ContextItem[], policy: ContextPolicy): Promise<void>;
```

**Engine authority:** validate the policy and incoming items, apply `defaultTtlSeconds` only when `item.ttlSeconds` is absent, and pass the effective policy to every write (an explicit `{}` when no policy is configured). `setPolicy()` changes defaults for *future* writes, without retroactively changing prior record TTLs. The engine does not use `stats()` to perform a non-atomic check-then-write.

**Store authority:** atomically enforce `maxItems`, `maxBytes`, supported eviction strategy, and stored TTL expiry; never return expired records from `query()`. `compact(policy)` removes expired records and applies current limits. TTL is measured from the item's `createdAt` timestamp in milliseconds plus `ttlSeconds * 1000`. Configured guarantees that a store cannot satisfy must reject the write/compaction with a typed `ContextPolicyUnsupportedError` instead of silently ignoring the limit.

For a functional, **in-memory demonstration only**, see [ContextMemoryStore.ts](../example/src/ContextMemoryStore.ts). That adapter supports `maxItems`, recency eviction, and TTL exclusion/compaction. It deliberately rejects `maxBytes`, `lru` and `size` eviction and is not a durable or encrypted persistence backend. Production adapters must use a transaction or equivalent atomic storage primitive for multi-writer correctness and must document their byte-accounting and LRU semantics.

A policy failure should never leave a partially accepted, falsely successful write. A missing/unknown `stats().totalBytes` is *not* evidence that `maxBytes` is satisfied. Retrieved records remain untrusted even when locally stored: Amaryllis revalidates their structure/media bounds before formatting or scoring.

If your store does not order results, the engine can apply a `ContextScorer` to rank them.

## Common Use Cases

- **Chat assistants**: store session memory plus episodic memories with TTL.
- **Games**: store world state and narrative facts, with tags for fast filtering.

## Notes

- No bundled vector DB. Semantic search is optional and up to your store and scorer.
- No on-device MCP server. Use tool interfaces or a bridge outside mobile if needed.
