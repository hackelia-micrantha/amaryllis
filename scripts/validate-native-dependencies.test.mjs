import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  EXPECTED_MEDIAPIPE_VERSION,
  validateNativeDependencies,
} from './validate-native-dependencies.mjs';

async function createFixture({
  androidVersion = EXPECTED_MEDIAPIPE_VERSION,
  podspecConstraint = `= ${EXPECTED_MEDIAPIPE_VERSION}`,
  lockedVersion = EXPECTED_MEDIAPIPE_VERSION,
  lockedCVersion = EXPECTED_MEDIAPIPE_VERSION,
  duplicateAndroidDependency = false,
} = {}) {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), 'amaryllis-native-deps-')
  );
  await mkdir(path.join(rootDir, 'android'), { recursive: true });
  await mkdir(path.join(rootDir, 'example/ios'), { recursive: true });

  const androidDependency =
    `  implementation 'com.google.mediapipe:tasks-genai:${androidVersion}'\n`;
  await writeFile(
    path.join(rootDir, 'android/build.gradle'),
    `dependencies {\n${androidDependency}${duplicateAndroidDependency ? androidDependency : ''}}\n`
  );
  await writeFile(
    path.join(rootDir, 'Amaryllis.podspec'),
    `Pod::Spec.new do |s|\n  s.dependency \"MediaPipeTasksGenAI\", \"${podspecConstraint}\"\nend\n`
  );
  await writeFile(
    path.join(rootDir, 'example/ios/Podfile.lock'),
    `PODS:\n  - MediaPipeTasksGenAI (${lockedVersion}):\n    - MediaPipeTasksGenAIC (= ${lockedCVersion})\n  - MediaPipeTasksGenAIC (${lockedCVersion})\n`
  );

  return rootDir;
}

async function withFixture(options, callback) {
  const rootDir = await createFixture(options);
  try {
    await callback(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test('repository declarations use the reviewed MediaPipe baseline', async () => {
  assert.equal(await validateNativeDependencies(), EXPECTED_MEDIAPIPE_VERSION);
});

test('accepts the reviewed cross-platform MediaPipe baseline', async () => {
  await withFixture({}, async (rootDir) => {
    assert.equal(
      await validateNativeDependencies({ rootDir }),
      EXPECTED_MEDIAPIPE_VERSION
    );
  });
});

test('rejects floating Android MediaPipe versions', async () => {
  await withFixture({ androidVersion: 'latest.release' }, async (rootDir) => {
    await assert.rejects(
      validateNativeDependencies({ rootDir }),
      /Android tasks-genai must be pinned to 0\.10\.24/
    );
  });
});

test('rejects duplicate Android MediaPipe declarations', async () => {
  await withFixture({ duplicateAndroidDependency: true }, async (rootDir) => {
    await assert.rejects(
      validateNativeDependencies({ rootDir }),
      /expected exactly one Android tasks-genai dependency; found 2/
    );
  });
});

test('rejects unconstrained iOS MediaPipe dependency', async () => {
  const rootDir = await createFixture();
  try {
    await writeFile(
      path.join(rootDir, 'Amaryllis.podspec'),
      'Pod::Spec.new do |s|\n  s.dependency "MediaPipeTasksGenAI"\nend\n'
    );
    await assert.rejects(
      validateNativeDependencies({ rootDir }),
      /must use an exact CocoaPods version constraint/
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('rejects Android and iOS MediaPipe version drift', async () => {
  await withFixture({ podspecConstraint: '= 0.10.23' }, async (rootDir) => {
    await assert.rejects(
      validateNativeDependencies({ rootDir }),
      /iOS MediaPipeTasksGenAI podspec must be pinned to 0\.10\.24/
    );
  });
});

test('rejects a stale iOS lockfile', async () => {
  await withFixture({ lockedVersion: '0.10.23' }, async (rootDir) => {
    await assert.rejects(
      validateNativeDependencies({ rootDir }),
      /lockfile must be pinned to 0\.10\.24/
    );
  });
});
