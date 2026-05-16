jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
}));
jest.mock('@react-native-documents/picker', () => ({
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
  },
  isErrorWithCode: jest.fn(),
  keepLocalCopy: jest.fn(),
  pick: jest.fn(),
}));

import {
  initialModelImportState,
  reduceModelImportState,
} from '../useModelImportViewModel';
import {
  createCompletionResult,
  createEmptyImportedModelsState,
} from '../domain';

describe('model import view model', () => {
  const importedLlm = {
    kind: 'llm' as const,
    label: 'LLM',
    filename: 'gemma-4-E4B-it.litertlm',
    uri: 'file:///models/llm/gemma-4-E4B-it.litertlm',
    path: '/models/llm/gemma-4-E4B-it.litertlm',
    sizeBytes: 100,
    importedAt: '2026-05-16T00:00:00.000Z',
  };

  it('tracks import phases and imported models', () => {
    const copying = reduceModelImportState(initialModelImportState, {
      type: 'import-phase-changed',
      kind: 'llm',
      phase: 'copying',
    });
    const imported = reduceModelImportState(copying, {
      type: 'import-succeeded',
      model: importedLlm,
    });
    const finished = reduceModelImportState(imported, {
      type: 'import-finished',
    });

    expect(copying.importing).toEqual({ kind: 'llm', phase: 'copying' });
    expect(imported.models.llm).toEqual(importedLlm);
    expect(finished.importing).toBeNull();
  });

  it('keeps optional models optional for completion readiness', () => {
    const models = {
      ...createEmptyImportedModelsState(),
      llm: importedLlm,
    };

    expect(createCompletionResult(models, false, false)).toEqual({
      llmModelPath: importedLlm.path,
      imageEmbedderModelPath: undefined,
      objectDetectorModelPath: undefined,
      models,
    });
  });

  it('requires configured extra models when policy says so', () => {
    const models = {
      ...createEmptyImportedModelsState(),
      llm: importedLlm,
    };

    expect(createCompletionResult(models, true, false)).toBeNull();
    expect(createCompletionResult(models, false, true)).toBeNull();
  });
});
