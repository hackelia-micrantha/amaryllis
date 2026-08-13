import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_MEDIAPIPE_VERSION = '0.10.24';

const ANDROID_ARTIFACTS = ['tasks-core', 'tasks-genai'];

function requireMatch(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function extractAndroidVersions(contents) {
  const versions = new Map();
  const dependencyPattern =
    /implementation\s+['"]com\.google\.mediapipe:(tasks-core|tasks-genai):([^'"]+)['"]/g;

  for (const match of contents.matchAll(dependencyPattern)) {
    const [, artifact, version] = match;
    if (versions.has(artifact)) {
      throw new Error(`duplicate Android MediaPipe dependency: ${artifact}`);
    }
    versions.set(artifact, version);
  }

  for (const artifact of ANDROID_ARTIFACTS) {
    requireMatch(
      versions.get(artifact),
      `missing Android MediaPipe dependency: ${artifact}`
    );
  }

  return versions;
}

function extractIosVersion(contents) {
  const match = contents.match(
    /s\.dependency\s+['"]MediaPipeTasksGenAI['"]\s*,\s*['"]\s*=\s*([^'"]+)['"]/m
  );
  return requireMatch(
    match?.[1],
    'MediaPipeTasksGenAI must use an exact CocoaPods version constraint'
  );
}

function extractLockedVersion(contents, podName) {
  const escapedPodName = podName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^  - ${escapedPodName} \\(([^)]+)\\):?\\s*$`,
    'm'
  );
  const match = contents.match(pattern);
  return requireMatch(match?.[1], `missing locked iOS pod: ${podName}`);
}

function assertExpectedVersion(actual, location) {
  if (actual !== EXPECTED_MEDIAPIPE_VERSION) {
    throw new Error(
      `${location} must be pinned to ${EXPECTED_MEDIAPIPE_VERSION}; found ${actual}`
    );
  }
}

export async function validateNativeDependencies({ rootDir = process.cwd() } = {}) {
  const [gradle, podspec, lockfile] = await Promise.all([
    readFile(path.join(rootDir, 'android/build.gradle'), 'utf8'),
    readFile(path.join(rootDir, 'Amaryllis.podspec'), 'utf8'),
    readFile(path.join(rootDir, 'example/ios/Podfile.lock'), 'utf8'),
  ]);

  const androidVersions = extractAndroidVersions(gradle);
  const coreVersion = androidVersions.get('tasks-core');
  const genaiVersion = androidVersions.get('tasks-genai');
  const iosVersion = extractIosVersion(podspec);
  const iosLockedVersion = extractLockedVersion(lockfile, 'MediaPipeTasksGenAI');
  const iosCLockedVersion = extractLockedVersion(lockfile, 'MediaPipeTasksGenAIC');

  assertExpectedVersion(coreVersion, 'Android tasks-core');
  assertExpectedVersion(genaiVersion, 'Android tasks-genai');
  assertExpectedVersion(iosVersion, 'iOS MediaPipeTasksGenAI podspec');
  assertExpectedVersion(iosLockedVersion, 'iOS MediaPipeTasksGenAI lockfile');
  assertExpectedVersion(iosCLockedVersion, 'iOS MediaPipeTasksGenAIC lockfile');

  if (coreVersion !== genaiVersion || genaiVersion !== iosVersion) {
    throw new Error(
      `MediaPipe versions must match across native declarations; found tasks-core=${coreVersion}, tasks-genai=${genaiVersion}, iOS=${iosVersion}`
    );
  }

  return EXPECTED_MEDIAPIPE_VERSION;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  try {
    const version = await validateNativeDependencies();
    console.log(`Native MediaPipe dependencies are pinned to ${version}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
