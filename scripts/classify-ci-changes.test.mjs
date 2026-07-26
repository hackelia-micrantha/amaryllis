import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyCiChanges } from './classify-ci-changes.mjs';

function dimensions(paths) {
  const { runRoot, runComponents, runNative } = classifyCiChanges(paths);
  return { runRoot, runComponents, runNative };
}

test('docs-only changes skip all expensive validation', () => {
  assert.deepEqual(dimensions(['docs/guide.md', 'README.md']), {
    runRoot: false,
    runComponents: false,
    runNative: false,
  });
});

test('root-only changes run root and native validation', () => {
  assert.deepEqual(dimensions(['src/index.ts']), {
    runRoot: true,
    runComponents: false,
    runNative: true,
  });
});

test('components-only changes run components validation', () => {
  assert.deepEqual(dimensions(['packages/amaryllis-components/src/index.ts']), {
    runRoot: false,
    runComponents: true,
    runNative: false,
  });
});

test('native-only changes run root and native validation', () => {
  assert.deepEqual(dimensions(['example/android/app/src/main/Module.kt']), {
    runRoot: true,
    runComponents: false,
    runNative: true,
  });
});

test('mixed root and components changes combine dimensions', () => {
  assert.deepEqual(
    dimensions(['src/index.ts', 'packages/amaryllis-components/src/index.ts']),
    { runRoot: true, runComponents: true, runNative: true }
  );
});

test('mixed components and native changes combine dimensions', () => {
  assert.deepEqual(
    dimensions(['packages/amaryllis-components/src/index.ts', 'example/ios/Module.swift']),
    { runRoot: true, runComponents: true, runNative: true }
  );
});

test('lockfile and workflow changes run all validation', () => {
  for (const path of ['yarn.lock', '.github/workflows/ci.yml']) {
    assert.deepEqual(dimensions([path]), {
      runRoot: true,
      runComponents: true,
      runNative: true,
    });
  }
});

test('rename from a relevant path into documentation remains relevant', () => {
  assert.deepEqual(dimensions(['src/old.ts', 'docs/old.ts']), {
    runRoot: true,
    runComponents: false,
    runNative: true,
  });
});

test('unknown paths fail closed', () => {
  assert.deepEqual(dimensions(['tools/new-helper.ts']), {
    runRoot: true,
    runComponents: true,
    runNative: true,
  });
});

test('missing and invalid path data fail closed', () => {
  for (const paths of [[], [null]]) {
    assert.deepEqual(dimensions(paths), {
      runRoot: true,
      runComponents: true,
      runNative: true,
    });
  }
});
