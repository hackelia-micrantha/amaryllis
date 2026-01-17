import { useMemo } from 'react';
import { LLMProvider } from 'react-native-amaryllis';
import {
  ContextEngineProvider,
  createContextEngine,
  type ContextItem,
  type ContextQuery,
  type ContextStore,
} from 'react-native-amaryllis/context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Chat } from './components';
import { PromptProvider } from './PromptContext';
import DL from '@kesha-antonov/react-native-background-downloader';

const createMemoryStore = (): ContextStore => {
  let items: ContextItem[] = [];

  return {
    async put(nextItems) {
      items = [...items, ...nextItems];
    },
    async query(query: ContextQuery) {
      let results = items;
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
      if (policy.maxItems && items.length > policy.maxItems) {
        items = [...items]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, policy.maxItems);
      }
    },
    async stats() {
      return { itemCount: items.length };
    },
  };
};

export default function App() {
  const contextEngine = useMemo(() => {
    return createContextEngine({
      store: createMemoryStore(),
      defaultQueryFactory: (prompt) => ({ text: prompt, limit: 6 }),
      policy: { maxItems: 250 },
    });
  }, []);

  return (
    <LLMProvider
      config={{
        modelPath: `${DL.directories.documents}/amaryllis.model`,
        visionEncoderPath: `${DL.directories.documents}/amaryllis.vision`,
        maxNumImages: 2,
      }}
    >
      <ContextEngineProvider engine={contextEngine}>
        <PromptProvider>
          <SafeAreaProvider>
            <Chat />
          </SafeAreaProvider>
        </PromptProvider>
      </ContextEngineProvider>
    </LLMProvider>
  );
}
