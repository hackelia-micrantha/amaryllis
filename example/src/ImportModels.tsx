import { ActivityIndicator } from 'react-native';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ModelImportPaths } from './ModelContext';
import { formatBytes, type ModelImportResult } from './modelImport/domain';
import { useModelImportViewModel } from './modelImport/useModelImportViewModel';

export type ModelImportScreenProps = {
  onComplete?: (paths: ModelImportPaths, result: ModelImportResult) => void;
  requireImageEmbedder?: boolean;
  requireObjectDetector?: boolean;
};

export default function ModelImportScreen({
  onComplete,
  requireImageEmbedder = false,
  requireObjectDetector = false,
}: ModelImportScreenProps) {
  const { state, importModel, removeModel, openUrl, continueToDemo } =
    useModelImportViewModel({
      onComplete,
      requireImageEmbedder,
      requireObjectDetector,
    });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Model Imports</Text>

      <Text style={styles.lede}>
        Download gated models in the browser first, then import the actual model
        files into app storage. Configure the SDK from these internal paths, not
        from public Downloads.
      </Text>

      {state.specs.map((spec) => {
        const imported = state.models[spec.kind];
        const isImporting = state.importing?.kind === spec.kind;
        const anyImporting = state.importing !== null;
        const required =
          spec.kind === 'llm' ||
          (spec.kind === 'imageEmbedder' && requireImageEmbedder) ||
          (spec.kind === 'objectDetector' && requireObjectDetector);

        return (
          <View key={spec.kind} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{spec.label}</Text>
              <Text
                style={[styles.badge, required ? styles.requiredBadge : null]}
              >
                {required ? 'Required' : 'Optional'}
              </Text>
            </View>

            <Text style={styles.description}>{spec.description}</Text>

            {spec.gated ? (
              <Text style={styles.warning}>
                Requires external license acceptance before import.
              </Text>
            ) : null}

            <View style={styles.row}>
              <Text style={styles.label}>Expected file</Text>
              <Text style={styles.value}>{spec.expectedFilename}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Download</Text>
              <Pressable onPress={() => openUrl(spec.downloadUrl)}>
                <Text style={styles.link} numberOfLines={3}>
                  {spec.downloadUrl}
                </Text>
              </Pressable>
            </View>

            {imported ? (
              <View style={styles.importedBox}>
                <Text style={styles.importedTitle}>Imported</Text>
                <Text style={styles.mono}>{imported.path}</Text>
                <Text style={styles.meta}>
                  {formatBytes(imported.sizeBytes)} ·{' '}
                  {new Date(imported.importedAt).toLocaleString()}
                </Text>
              </View>
            ) : (
              <View style={styles.missingBox}>
                <Text style={styles.missingText}>Not imported</Text>
              </View>
            )}

            {isImporting ? (
              <View style={styles.progressRow}>
                <ActivityIndicator />
                <Text style={styles.progressText}>
                  {state.importing?.phase === 'copying'
                    ? 'Copying file into app storage…'
                    : state.importing?.phase === 'validating'
                      ? 'Validating imported file…'
                      : 'Finalizing imported file…'}
                </Text>
              </View>
            ) : null}

            <View style={styles.buttonRow}>
              <Pressable
                style={[
                  styles.primaryButton,
                  anyImporting && styles.disabledButton,
                ]}
                disabled={anyImporting}
                onPress={() => importModel(spec.kind)}
              >
                <Text style={styles.primaryButtonText}>
                  {imported ? 'Replace file' : 'Import file'}
                </Text>
              </Pressable>

              {imported ? (
                <Pressable
                  style={[
                    styles.secondaryButton,
                    anyImporting && styles.disabledButton,
                  ]}
                  disabled={anyImporting}
                  onPress={() => removeModel(spec.kind)}
                >
                  <Text style={styles.secondaryButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>SDK configuration paths</Text>

        <Text style={styles.description}>
          Pass these paths down to your native MediaPipe / LiteRT bridge after
          the required files are imported.
        </Text>

        <Text style={styles.monoBlock}>
          {JSON.stringify(
            {
              llmModelPath: state.models.llm?.path ?? null,
              imageEmbedderModelPath: state.models.imageEmbedder?.path ?? null,
              objectDetectorModelPath:
                state.models.objectDetector?.path ?? null,
              ready: state.canConfigure,
            },
            null,
            2
          )}
        </Text>

        {!state.canConfigure ? (
          <Text style={styles.warning}>
            Import the required models before configuring the SDK.
          </Text>
        ) : (
          <Text style={styles.ready}>Ready to configure SDK.</Text>
        )}

        <Pressable
          style={[
            styles.primaryButton,
            !state.canConfigure && styles.disabledButton,
          ]}
          disabled={!state.canConfigure}
          onPress={continueToDemo}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  lede: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.75,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: 'rgba(245,245,240,1)',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  requiredBadge: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.75,
  },
  row: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  importedBox: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    gap: 6,
  },
  importedTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  missingBox: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  missingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
  },
  monoBlock: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  meta: {
    fontSize: 12,
    opacity: 0.65,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    opacity: 0.75,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'black',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  secondaryButtonText: {
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.4,
  },
  warning: {
    fontSize: 14,
    color: '#8a5a00',
    fontWeight: '600',
  },
  ready: {
    fontSize: 14,
    color: '#246b2e',
    fontWeight: '700',
  },
});
