const mockExists = jest.fn();
const mockStat = jest.fn();
const mockRead = jest.fn();

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
  exists: (...args: unknown[]) => mockExists(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  read: (...args: unknown[]) => mockRead(...args),
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
  loadExistingModels,
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockResolvedValue('');
  });

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

  it('does not overwrite newly imported models when existing-file scan resolves', () => {
    const imported = reduceModelImportState(initialModelImportState, {
      type: 'import-succeeded',
      model: importedLlm,
    });
    const hydrated = reduceModelImportState(imported, {
      type: 'existing-models-loaded',
      models: createEmptyImportedModelsState(),
    });

    expect(hydrated.models.llm).toEqual(importedLlm);
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

  it('hydrates valid models that already exist in app storage', async () => {
    mockExists.mockImplementation(async (path: string) =>
      path.endsWith('/models/llm/gemma-4-E4B-it.litertlm')
    );
    mockStat.mockResolvedValue({
      isFile: () => true,
      size: 60 * 1024 * 1024,
    });

    const models = await loadExistingModels();

    expect(models.llm).toEqual(
      expect.objectContaining({
        kind: 'llm',
        path: '/documents/models/llm/gemma-4-E4B-it.litertlm',
        filename: 'gemma-4-E4B-it.litertlm',
      })
    );
    expect(models.imageEmbedder).toBeNull();
    expect(models.objectDetector).toBeNull();
  });

  it('ignores invalid existing model files', async () => {
    mockExists.mockResolvedValue(true);
    mockStat.mockResolvedValue({
      isFile: () => true,
      size: 1,
    });

    const models = await loadExistingModels();

    expect(models).toEqual(createEmptyImportedModelsState());
  });
});
