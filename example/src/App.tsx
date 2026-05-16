import { useMemo, useState } from 'react';
import { LLMProvider } from '@micrantha/react-native-amaryllis';
import {
  createContextEngine,
  type ContextItem,
  type ContextQuery,
  type ContextStore,
} from '@micrantha/amaryllis/context';
import { ContextEngineProvider } from '@micrantha/react-native-amaryllis/context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RegistryProvider } from '@micrantha/amaryllis-components';
import { Chat } from './components';
import { PromptProvider } from './PromptContext';
import { ModelProvider, useModelContext } from './ModelContext';
import { default as WelcomeScreen } from './ImportModels';
import { registerExampleAiComponents } from './ai/registerComponents';
import { PersonaDemoScreen } from './personaDemo/PersonaDemoScreen';

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
      }}
    >
      <ContextEngineProvider engine={contextEngine}>
        <PromptProvider>
          <DemoExperience />
        </PromptProvider>
      </ContextEngineProvider>
    </LLMProvider>
  );
}

type DemoScreen = 'chat' | 'persona-demo';

function DemoExperience() {
  const [screen, setScreen] = useState<DemoScreen>('chat');

  return (
    <SafeAreaProvider>
      <View style={styles.demoContainer}>
        <View style={styles.demoSwitcher}>
          <Text style={styles.demoLabel}>Demo</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: screen === 'chat' }}
            onPress={() => setScreen('chat')}
            style={[
              styles.demoButton,
              screen === 'chat' && styles.selectedDemoButton,
            ]}
          >
            <Text
              style={[
                styles.demoButtonLabel,
                screen === 'chat' && styles.selectedDemoButtonLabel,
              ]}
            >
              Chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: screen === 'persona-demo' }}
            onPress={() => setScreen('persona-demo')}
            style={[
              styles.demoButton,
              screen === 'persona-demo' && styles.selectedDemoButton,
            ]}
          >
            <Text
              style={[
                styles.demoButtonLabel,
                screen === 'persona-demo' && styles.selectedDemoButtonLabel,
              ]}
            >
              Personas
            </Text>
          </TouchableOpacity>
        </View>

        {screen === 'chat' ? <Chat /> : <PersonaDemoScreen />}
      </View>
    </SafeAreaProvider>
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

const styles = StyleSheet.create({
  demoContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  demoSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  demoLabel: {
    marginRight: 4,
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  demoButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  selectedDemoButton: {
    backgroundColor: '#dbeafe',
  },
  demoButtonLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedDemoButtonLabel: {
    color: '#1d4ed8',
  },
});
