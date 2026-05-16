import { useMemo } from 'react';
import { LLMProvider } from '@micrantha/react-native-amaryllis';
import {
  createContextEngine,
  type ContextItem,
  type ContextQuery,
  type ContextStore,
} from '@micrantha/amaryllis/context';
import { ContextEngineProvider } from '@micrantha/react-native-amaryllis/context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RegistryProvider } from '@micrantha/amaryllis-components';
import { Chat } from './components';
import { PromptProvider } from './PromptContext';
import { ModelProvider, useModelContext } from './ModelContext';
import { default as WelcomeScreen } from './ImportModels';
import { registerExampleAiComponents } from './ai/registerComponents';

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

function AppGate() {
  const { paths: models, setPaths: setModelsReady } = useModelContext();

  const contextEngine = useMemo(() => {
    return createContextEngine({
      store: createMemoryStore(),
      defaultQueryFactory: (prompt) => ({ text: prompt, limit: 6 }),
      policy: { maxItems: 250 },
    });
  }, []);

  if (!models) {
    return <WelcomeScreen onComplete={(paths) => setModelsReady(paths)} />;
  }

  return (
    <LLMProvider
      config={{
        modelPath: models.llmModelPath,
        visionEncoderPath: models.imageEmbedderModelPath,
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

export default function App() {
  return (
    <ModelProvider>
      <RegistryProvider initialize={registerExampleAiComponents}>
        <AppGate />
      </RegistryProvider>
    </ModelProvider>
  );
}
