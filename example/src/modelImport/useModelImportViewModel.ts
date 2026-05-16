import { useCallback, useMemo, useReducer } from 'react';
import { Alert, Linking } from 'react-native';
import RNFS from 'react-native-fs';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
} from '@react-native-documents/picker';
import type { ModelImportPaths } from '../ModelContext';
import {
  MODEL_SPECS,
  createCompletionResult,
  createEmptyImportedModelsState,
  getSelectedFilename,
  joinPath,
  stripFilePrefix,
  validateImportedFile,
  type ImportedModel,
  type ImportedModelsState,
  type ModelImportResult,
  type ModelKind,
  type ModelSpec,
} from './domain';

export type ImportPhase = 'copying' | 'validating' | 'finalizing';

export interface ModelImportState {
  models: ImportedModelsState;
  importing: {
    kind: ModelKind;
    phase: ImportPhase;
  } | null;
}

export type ModelImportIntent =
  | { type: 'import-started'; kind: ModelKind; phase: ImportPhase }
  | { type: 'import-phase-changed'; kind: ModelKind; phase: ImportPhase }
  | { type: 'import-succeeded'; model: ImportedModel }
  | { type: 'import-finished' }
  | { type: 'model-removed'; kind: ModelKind };

export interface UseModelImportViewModelParams {
  onComplete?: (paths: ModelImportPaths, result: ModelImportResult) => void;
  requireImageEmbedder: boolean;
  requireObjectDetector: boolean;
}

export const initialModelImportState: ModelImportState = {
  models: createEmptyImportedModelsState(),
  importing: null,
};

export const reduceModelImportState = (
  state: ModelImportState,
  intent: ModelImportIntent
): ModelImportState => {
  switch (intent.type) {
    case 'import-started':
    case 'import-phase-changed':
      return {
        ...state,
        importing: {
          kind: intent.kind,
          phase: intent.phase,
        },
      };
    case 'import-succeeded':
      return {
        ...state,
        models: {
          ...state.models,
          [intent.model.kind]: intent.model,
        },
      };
    case 'import-finished':
      return {
        ...state,
        importing: null,
      };
    case 'model-removed':
      return {
        ...state,
        models: {
          ...state.models,
          [intent.kind]: null,
        },
      };
  }
};

async function importModelFile(
  spec: ModelSpec,
  onPhaseChange: (phase: ImportPhase) => void
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

  onPhaseChange('copying');
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

  onPhaseChange('validating');
  await validateImportedFile(spec, tempLocalPath, selectedFilename);

  if (await RNFS.exists(destinationPath)) {
    await RNFS.unlink(destinationPath);
  }

  onPhaseChange('finalizing');
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

export const useModelImportViewModel = ({
  onComplete,
  requireImageEmbedder,
  requireObjectDetector,
}: UseModelImportViewModelParams) => {
  const [state, dispatch] = useReducer(
    reduceModelImportState,
    initialModelImportState
  );

  const specsByKind = useMemo(
    () =>
      MODEL_SPECS.reduce(
        (acc, spec) => {
          acc[spec.kind] = spec;
          return acc;
        },
        {} as Record<ModelKind, ModelSpec>
      ),
    []
  );

  const completion = useMemo(
    () =>
      createCompletionResult(
        state.models,
        requireImageEmbedder,
        requireObjectDetector
      ),
    [requireImageEmbedder, requireObjectDetector, state.models]
  );

  const importModel = useCallback(
    async (kind: ModelKind) => {
      const spec = specsByKind[kind];

      try {
        const imported = await importModelFile(spec, (phase) => {
          dispatch({ type: 'import-phase-changed', kind, phase });
        });

        dispatch({ type: 'import-succeeded', model: imported });
        Alert.alert('Model imported', `${imported.filename}\n${imported.path}`);
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
        dispatch({ type: 'import-finished' });
      }
    },
    [specsByKind]
  );

  const removeModel = useCallback(
    async (kind: ModelKind) => {
      const imported = state.models[kind];

      try {
        if (imported?.path && (await RNFS.exists(imported.path))) {
          await RNFS.unlink(imported.path);
        }

        dispatch({ type: 'model-removed', kind });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : undefined;
        Alert.alert('Remove failed', message ?? 'Could not remove model');
      }
    },
    [state.models]
  );

  const openUrl = useCallback(async (url: string) => {
    await Linking.openURL(url);
  }, []);

  const continueToDemo = useCallback(() => {
    if (!completion) {
      Alert.alert('Missing models', 'Import the required models first.');
      return;
    }

    onComplete?.(
      {
        llmModelPath: completion.llmModelPath,
        imageEmbedderModelPath: completion.imageEmbedderModelPath,
        objectDetectorModelPath: completion.objectDetectorModelPath,
      },
      completion
    );
  }, [completion, onComplete]);

  return {
    state: {
      specs: MODEL_SPECS,
      models: state.models,
      importing: state.importing,
      canConfigure: completion !== null,
    },
    importModel,
    removeModel,
    openUrl,
    continueToDemo,
  };
};
