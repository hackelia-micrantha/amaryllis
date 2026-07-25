import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useModelContext } from '../ModelContext';

export const ModelSettingsScreen = () => {
  const { paths, setPaths } = useModelContext();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Model settings</Text>
      <Text style={styles.description}>
        Current app-private model paths used by the demo.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>LLM model</Text>
        <Text style={styles.mono}>
          {paths?.llmModelPath ?? 'Not configured'}
        </Text>

        <Text style={styles.label}>Image embedder</Text>
        <Text style={styles.mono}>
          {paths?.imageEmbedderModelPath ?? 'Not configured'}
        </Text>

        <Text style={styles.label}>Object detector</Text>
        <Text style={styles.mono}>
          {paths?.objectDetectorModelPath ?? 'Not configured'}
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => setPaths(null)}>
        <Text style={styles.primaryButtonText}>Manage models</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: '#fff',
  },
  heading: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  label: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mono: {
    color: '#111827',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#111827',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
