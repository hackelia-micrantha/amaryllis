import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_MEDIAPIPE_VERSION = '0.10.24';

function requireMatch(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function extractAndroidVersion(contents) {
  const matches = [
    ...contents.matchAll(
      /implementation\s+['"]com\.google\.mediapipe:tasks-genai:([^'"]+)['"]/g
    ),
  ];
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one Android tasks-genai dependency; found ${matches.length}`
    );
  }
  return matches[0][1];
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
  const match = contents.match(
    new RegExp(`^  - ${escapedPodName} \\(([^)]+)\\):?\\s*$`, 'm')
  );
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

  const androidVersion = extractAndroidVersion(gradle);
  const iosVersion = extractIosVersion(podspec);
  const iosLockedVersion = extractLockedVersion(lockfile, 'MediaPipeTasksGenAI');
  const iosCLockedVersion = extractLockedVersion(lockfile, 'MediaPipeTasksGenAIC');

  assertExpectedVersion(androidVersion, 'Android tasks-genai');
  assertExpectedVersion(iosVersion, 'iOS MediaPipeTasksGenAI podspec');
  assertExpectedVersion(iosLockedVersion, 'iOS MediaPipeTasksGenAI lockfile');
  assertExpectedVersion(iosCLockedVersion, 'iOS MediaPipeTasksGenAIC lockfile');

  if (androidVersion !== iosVersion) {
    throw new Error(
      `MediaPipe versions must match across native declarations; found Android=${androidVersion}, iOS=${iosVersion}`
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
