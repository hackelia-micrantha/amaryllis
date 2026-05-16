import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RNFS from 'react-native-fs';
import {
  keepLocalCopy,
  pick,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';
import type { ModelImportPaths } from './ModelContext';

type ModelKind = 'llm' | 'imageEmbedder' | 'objectDetector';

type ModelSpec = {
  kind: ModelKind;
  label: string;
  description: string;
  expectedFilename: string;
  extension: '.litertlm' | '.tflite';
  minBytes: number;
  downloadUrl: string;
  storageSubdir: string;
  gated: boolean;
};

type ImportedModel = {
  kind: ModelKind;
  label: string;
  filename: string;
  uri: string;
  path: string;
  sizeBytes: number;
  importedAt: string;
};

type ImportedModelsState = Record<ModelKind, ImportedModel | null>;
type ImportPhase = 'copying' | 'validating' | 'finalizing';

export type ModelImportResult = ModelImportPaths & {
  models: ImportedModelsState;
};

export type ModelImportScreenProps = {
  onComplete?: (paths: ModelImportPaths, result: ModelImportResult) => void;
  requireImageEmbedder?: boolean;
  requireObjectDetector?: boolean;
};

const MODEL_SPECS: ModelSpec[] = [
  {
    kind: 'llm',
    label: 'LLM / Multimodal Inference Model',
    description:
      'Gemma 4 E4B LiteRT-LM bundle. This model is gated and requires Hugging Face license acceptance before manual download.',
    expectedFilename: 'gemma-4-E4B-it.litertlm',
    extension: '.litertlm',
    // Defensive lower bound. Real file should be much larger.
    minBytes: 50 * 1024 * 1024,
    downloadUrl:
      'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/blob/main/gemma-4-E4B-it.litertlm',
    storageSubdir: 'models/llm',
    gated: true,
  },
  {
    kind: 'imageEmbedder',
    label: 'Image Embedder',
    description:
      'MobileNet V3 image embedder for image similarity/search. This is not the Gemma vision encoder; Gemma multimodal vision is handled by the LLM bundle itself.',
    expectedFilename: 'mobilenet_v3_small.tflite',
    extension: '.tflite',
    minBytes: 1 * 1024 * 1024,
    downloadUrl:
      'https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite',
    storageSubdir: 'models/image-embedder',
    gated: false,
  },
  {
    kind: 'objectDetector',
    label: 'Object Detector',
    description:
      'EfficientDet-Lite0 object detector. Use this as a separate MediaPipe ObjectDetector pipeline, not as a Gemma vision encoder.',
    expectedFilename: 'efficientdet_lite0.tflite',
    extension: '.tflite',
    minBytes: 1 * 1024 * 1024,
    downloadUrl:
      'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite',
    storageSubdir: 'models/object-detection',
    gated: false,
  },
];

function createEmptyImportedModelsState(): ImportedModelsState {
  return {
    llm: null,
    imageEmbedder: null,
    objectDetector: null,
  };
}

function stripFilePrefix(uriOrPath: string): string {
  return uriOrPath.startsWith('file://')
    ? uriOrPath.replace('file://', '')
    : uriOrPath;
}

function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace('file:/', 'file://');
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return 'unknown';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function getSelectedFilename(uri: string, pickerName?: string | null): string {
  if (pickerName) return pickerName;

  try {
    const decoded = decodeURIComponent(uri);
    return decoded.split('/').pop() ?? 'unknown';
  } catch {
    return uri.split('/').pop() ?? 'unknown';
  }
}

async function readAsciiPrefix(path: string, byteCount = 512): Promise<string> {
  try {
    // react-native-fs returns a base64 string for this encoding.
    const base64 = await RNFS.read(path, byteCount, 0, 'base64');

    // Avoid requiring Buffer. This is intentionally lightweight: enough to spot
    // common HTML/login/error payloads that were saved instead of model files.
    if (typeof globalThis.atob !== 'function') {
      return '';
    }

    return globalThis.atob(base64);
  } catch {
    return '';
  }
}

async function validateImportedFile(
  spec: ModelSpec,
  localPath: string,
  originalName?: string | null
): Promise<{ sizeBytes: number }> {
  const stat = await RNFS.stat(localPath);

  if (!stat.isFile()) {
    throw new Error('Selected item is not a file.');
  }

  const sizeBytes = Number(stat.size ?? 0);
  const filename = originalName ?? localPath.split('/').pop() ?? '';

  if (!filename.toLowerCase().endsWith(spec.extension)) {
    throw new Error(
      `Expected a ${spec.extension} file for ${spec.label}. Selected: ${filename}`
    );
  }

  if (sizeBytes < spec.minBytes) {
    throw new Error(
      `File looks too small for ${spec.label}: ${formatBytes(
        sizeBytes
      )}. This often means you imported an HTML login/license/error page instead of the actual model.`
    );
  }

  const prefix = await readAsciiPrefix(localPath);
  const lower = prefix.toLowerCase();

  if (
    lower.includes('<html') ||
    lower.includes('<!doctype') ||
    lower.includes('hugging face') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    throw new Error(
      'The selected file appears to be an HTML/auth/error page, not a model file. Accept the license and download the actual model artifact first.'
    );
  }

  return { sizeBytes };
}

async function importModelFile(
  spec: ModelSpec,
  onPhaseChange?: (phase: ImportPhase) => void
): Promise<ImportedModel> {
  const [picked] = await pick({
    allowMultiSelection: false,
    mode: 'import',
  });

  const selectedFilename = getSelectedFilename(picked.uri, picked.name);
  const destinationDir = joinPath(
    RNFS.DocumentDirectoryPath,
    spec.storageSubdir
  );
  const destinationPath = joinPath(destinationDir, spec.expectedFilename);

  await RNFS.mkdir(destinationDir);

  // keepLocalCopy converts Android content:// URIs into app-readable files.
  // We copy to documentDirectory first, validate, then move to the stable path.
  onPhaseChange?.('copying');
  const [copyResult] = await keepLocalCopy({
    files: [
      {
        uri: picked.uri,
        fileName: selectedFilename,
      },
    ],
    destination: 'documentDirectory',
  });

  if (copyResult.status !== 'success') {
    throw new Error(
      `Could not import ${spec.label}: ${copyResult.copyError ?? 'unknown error'}`
    );
  }

  const tempLocalPath = stripFilePrefix(copyResult.localUri);

  onPhaseChange?.('validating');
  await validateImportedFile(spec, tempLocalPath, selectedFilename);

  // Normalize into a stable app-private model path with the exact filename the
  // native bridge expects.
  if (await RNFS.exists(destinationPath)) {
    await RNFS.unlink(destinationPath);
  }

  onPhaseChange?.('finalizing');
  await RNFS.moveFile(tempLocalPath, destinationPath);

  const finalValidation = await validateImportedFile(
    spec,
    destinationPath,
    spec.expectedFilename
  );

  return {
    kind: spec.kind,
    label: spec.label,
    filename: spec.expectedFilename,
    uri: `file://${destinationPath}`,
    path: destinationPath,
    sizeBytes: finalValidation.sizeBytes,
    importedAt: new Date().toISOString(),
  };
}

export default function ModelImportScreen({
  onComplete,
  requireImageEmbedder = false,
  requireObjectDetector = false,
}: ModelImportScreenProps) {
  const [models, setModels] = useState<ImportedModelsState>(
    createEmptyImportedModelsState
  );
  const [importing, setImporting] = useState<{
    kind: ModelKind;
    phase: ImportPhase;
  } | null>(null);

  const specsByKind = useMemo(() => {
    return MODEL_SPECS.reduce(
      (acc, spec) => {
        acc[spec.kind] = spec;
        return acc;
      },
      {} as Record<ModelKind, ModelSpec>
    );
  }, []);

  const getCompletionResult = useCallback(
    (nextModels: ImportedModelsState): ModelImportResult | null => {
      const llmPath = nextModels.llm?.path;

      if (!llmPath) {
        return null;
      }

      if (requireImageEmbedder && !nextModels.imageEmbedder?.path) {
        return null;
      }

      if (requireObjectDetector && !nextModels.objectDetector?.path) {
        return null;
      }

      return {
        llmModelPath: llmPath,
        imageEmbedderModelPath: nextModels.imageEmbedder?.path,
        objectDetectorModelPath: nextModels.objectDetector?.path,
        models: nextModels,
      };
    },
    [requireImageEmbedder, requireObjectDetector]
  );

  const emitComplete = useCallback(
    (completion: ModelImportResult) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { models: _models, ...paths } = completion;
      onComplete?.(paths, completion);
    },
    [onComplete]
  );

  const onImport = useCallback(
    async (kind: ModelKind) => {
      const spec = specsByKind[kind];

      try {
        const imported = await importModelFile(spec, (phase) => {
          setImporting({ kind, phase });
        });
        const next = { ...models, [kind]: imported };

        setModels(next);

        const completion = getCompletionResult(next);

        Alert.alert('Model imported', `${imported.filename}\n${imported.path}`);

        if (completion) {
          emitComplete(completion);
        }
      } catch (error: unknown) {
        if (
          isErrorWithCode(error) &&
          error.code === errorCodes.OPERATION_CANCELED
        ) {
          return;
        }

        const message = error instanceof Error ? error.message : undefined;

        Alert.alert(
          'Import failed',
          message ?? `Could not import ${spec.label}`
        );
      } finally {
        setImporting(null);
      }
    },
    [models, specsByKind, getCompletionResult, emitComplete]
  );

  const onRemove = useCallback(
    async (kind: ModelKind) => {
      const imported = models[kind];

      try {
        if (imported?.path && (await RNFS.exists(imported.path))) {
          await RNFS.unlink(imported.path);
        }

        setModels({ ...models, [kind]: null });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : undefined;
        Alert.alert('Remove failed', message ?? 'Could not remove model');
      }
    },
    [models]
  );

  const openUrl = useCallback(async (url: string) => {
    /*const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert('Cannot open URL', url);
      return;
    }*/

    await Linking.openURL(url);
  }, []);

  const onContinue = useCallback(() => {
    const completion = getCompletionResult(models);

    if (!completion) {
      Alert.alert('Missing models', 'Import the required models first.');
      return;
    }

    emitComplete(completion);
  }, [models, getCompletionResult, emitComplete]);

  const canConfigure = Boolean(getCompletionResult(models));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Model Imports</Text>

      <Text style={styles.lede}>
        Download gated models in the browser first, then import the actual model
        files into app storage. Configure the SDK from these internal paths, not
        from public Downloads.
      </Text>

      {MODEL_SPECS.map((spec) => {
        const imported = models[spec.kind];
        const isImporting = importing?.kind === spec.kind;
        const anyImporting = importing !== null;
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
                  {importing.phase === 'copying'
                    ? 'Copying file into app storage…'
                    : importing.phase === 'validating'
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
                onPress={() => onImport(spec.kind)}
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
                  onPress={() => onRemove(spec.kind)}
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
              llmModelPath: models.llm?.path ?? null,
              imageEmbedderModelPath: models.imageEmbedder?.path ?? null,
              objectDetectorModelPath: models.objectDetector?.path ?? null,
              ready: canConfigure,
            },
            null,
            2
          )}
        </Text>

        {!canConfigure ? (
          <Text style={styles.warning}>
            Import the required models before configuring the SDK.
          </Text>
        ) : (
          <Text style={styles.ready}>Ready to configure SDK.</Text>
        )}

        <Pressable
          style={[styles.primaryButton, !canConfigure && styles.disabledButton]}
          disabled={!canConfigure}
          onPress={onContinue}
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
