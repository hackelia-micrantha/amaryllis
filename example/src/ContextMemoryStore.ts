import { ContextPolicyUnsupportedError } from '@micrantha/amaryllis';
import type {
  ContextItem,
  ContextPolicy,
  ContextQuery,
  ContextStore,
} from '@micrantha/amaryllis/context';

// Illustrative in-memory adapter, not a durable/context-encrypted store.
// It supports recency eviction + maxItems and refuses unsupported limits.
export const createMemoryStore = (): ContextStore => {
  let items: ContextItem[] = [];

  const live = (source: ContextItem[]): ContextItem[] =>
    source.filter(
      (item) =>
        item.ttlSeconds === undefined ||
        item.createdAt + item.ttlSeconds * 1000 > Date.now()
    );

  const enforce = (
    candidate: ContextItem[],
    policy: ContextPolicy
  ): ContextItem[] => {
    if (policy.maxBytes !== undefined) {
      throw new ContextPolicyUnsupportedError(
        'The example memory store cannot enforce maxBytes'
      );
    }
    if (
      policy.evictionStrategy !== undefined &&
      policy.evictionStrategy !== 'recency'
    ) {
      throw new ContextPolicyUnsupportedError(
        'The example memory store only supports recency eviction'
      );
    }

    let next = live(candidate);
    if (policy.maxItems !== undefined && next.length > policy.maxItems) {
      next = [...next]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, policy.maxItems);
    }
    return next;
  };

  return {
    async put(nextItems, policy) {
      // Compute before committing: a rejected limit leaves storage unchanged.
      const next = enforce([...items, ...nextItems], policy);
      items = next;
    },
    async query(query: ContextQuery) {
      let results = live(items);
      if (query.tags && query.tags.length > 0) {
        results = results.filter((item) =>
          query.tags?.every((tag) => item.tags?.includes(tag))
        );
      }
      if (query.filters) {
        results = results.filter((item) =>
          Object.entries(query.filters ?? {}).every(
            ([key, value]) => item.metadata?.[key] === value
          )
        );
      }
      const needle = query.text.toLowerCase();
      results = results.filter((item) =>
        item.text.toLowerCase().includes(needle)
      );
      if (query.limit) {
        results = results.slice(0, query.limit);
      }
      return results;
    },
    async delete(ids) {
      const idSet = new Set(ids);
      items = items.filter((item) => !idSet.has(item.id));
    },
    async compact(policy) {
      items = enforce(items, policy);
    },
    async stats() {
      return { itemCount: items.length };
    },
  };
};
      }
    },
    async stats() {
      return { itemCount: items.length };
    },
  };
};
