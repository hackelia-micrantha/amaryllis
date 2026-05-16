import RNFS from 'react-native-fs';
import type { ModelImportPaths } from '../ModelContext';

export type ModelKind = 'llm' | 'imageEmbedder' | 'objectDetector';

export type ModelSpec = {
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

export type ImportedModel = {
  kind: ModelKind;
  label: string;
  filename: string;
  uri: string;
  path: string;
  sizeBytes: number;
  importedAt: string;
};

export type ImportedModelsState = Record<ModelKind, ImportedModel | null>;

export type ModelImportResult = ModelImportPaths & {
  models: ImportedModelsState;
};

export const MODEL_SPECS: ModelSpec[] = [
  {
    kind: 'llm',
    label: 'LLM / Multimodal Inference Model',
    description:
      'Gemma 4 E4B LiteRT-LM bundle. This model is gated and requires Hugging Face license acceptance before manual download.',
    expectedFilename: 'gemma-4-E4B-it.litertlm',
    extension: '.litertlm',
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

export function createEmptyImportedModelsState(): ImportedModelsState {
  return {
    llm: null,
    imageEmbedder: null,
    objectDetector: null,
  };
}

export function stripFilePrefix(uriOrPath: string): string {
  return uriOrPath.startsWith('file://')
    ? uriOrPath.replace('file://', '')
    : uriOrPath;
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace('file:/', 'file://');
}

export function formatBytes(bytes: number): string {
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

export function getSelectedFilename(
  uri: string,
  pickerName?: string | null
): string {
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
    const base64 = await RNFS.read(path, byteCount, 0, 'base64');

    if (typeof globalThis.atob !== 'function') {
      return '';
    }

    return globalThis.atob(base64);
  } catch {
    return '';
  }
}

export async function validateImportedFile(
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

export function createCompletionResult(
  models: ImportedModelsState,
  requireImageEmbedder: boolean,
  requireObjectDetector: boolean
): ModelImportResult | null {
  const llmPath = models.llm?.path;

  if (!llmPath) {
    return null;
  }

  if (requireImageEmbedder && !models.imageEmbedder?.path) {
    return null;
  }

  if (requireObjectDetector && !models.objectDetector?.path) {
    return null;
  }

  return {
    llmModelPath: llmPath,
    imageEmbedderModelPath: models.imageEmbedder?.path,
    objectDetectorModelPath: models.objectDetector?.path,
    models,
  };
}
