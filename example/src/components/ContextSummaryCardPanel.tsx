import { PersonalizedComponent } from '@micrantha/amaryllis-components';
import { useInference } from '@micrantha/react-native-amaryllis';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePromptContext } from '../PromptContext';

export const ContextSummaryCardPanel = () => {
  const { messages } = usePromptContext();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const assistantMessages = useMemo(
    () => messages.filter((m) => m.role === 'assistant' && m.content),
    [messages]
  );

  const generate = useInference({
    onGenerate: () => setIsGenerating(true),
    onResult: (result) => {
      setAiSummary(result);
      setIsGenerating(false);
    },
    onError: () => setIsGenerating(false),
  });

  const onSummarize = useCallback(() => {
    if (assistantMessages.length === 0) return;

    const conversation = assistantMessages.map((m) => m.content).join('\n');
    generate({
      prompt: `Summarize this conversation in one short sentence for a dashboard card:\n${conversation}`,
    });
  }, [generate, assistantMessages]);

  const baseProps = useMemo(
    () => ({
      title: 'Conversation context',
      description:
        'No generated context yet. Start a conversation to adapt me.',
    }),
    []
  );

  const personalizationData = useMemo(
    () => ({
      ...(assistantMessages.length === 0 && { variant: 'compact' }),
      props: {
        title: 'Conversation context',
        description:
          aiSummary ||
          (assistantMessages.length === 0
            ? 'No generated context yet. Start a conversation to adapt me.'
            : `${assistantMessages.length} message${
                assistantMessages.length === 1 ? '' : 's'
              } exchanged. Click summarize to see more.`),
      },
    }),
    [aiSummary, assistantMessages.length]
  );

  return (
    <View style={styles.container}>
      <PersonalizedComponent
        name="context-summary-card"
        baseProps={baseProps}
        personalizationData={personalizationData}
        loading={isGenerating}
      />
      {assistantMessages.length > 0 && !aiSummary && !isGenerating && (
        <Pressable style={styles.summarizeButton} onPress={onSummarize}>
          <Text style={styles.summarizeButtonText}>✨ Summarize with AI</Text>
        </Pressable>
      )}
      {isGenerating && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  summarizeButton: {
    position: 'absolute',
    right: 32,
    top: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summarizeButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563eb',
  },
  loading: {
    position: 'absolute',
    right: 32,
    top: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loadingText: {
    fontSize: 10,
    color: '#6b7280',
  },
});
