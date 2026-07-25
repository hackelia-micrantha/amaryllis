import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyCiChanges } from './classify-ci-changes.mjs';

test('skips native builds for documentation-only changes', () => {
  assert.deepEqual(classifyCiChanges(['docs/examples/README.md']), {
    runNative: false,
    reason: 'all changed paths are explicitly classified as non-native',
  });
});

test('skips native builds for components-only changes', () => {
  assert.equal(
    classifyCiChanges([
      'packages/amaryllis-components/src/generator/schema.ts',
      'packages/amaryllis-components/src/__tests__/SchemaGenerator.test.ts',
    ]).runNative,
    false
  );
});

test('skips native builds for root markdown changes', () => {
  assert.equal(classifyCiChanges(['README.md', 'RELEASE.md']).runNative, false);
});

test('runs native builds for shared runtime changes', () => {
  assert.equal(classifyCiChanges(['src/index.ts']).runNative, true);
});

test('runs native builds for lockfile and workflow changes', () => {
  assert.equal(
    classifyCiChanges(['yarn.lock', '.github/workflows/ci.yml']).runNative,
    true
  );
});

test('fails closed when no changed paths are available', () => {
  assert.deepEqual(classifyCiChanges([]), {
    runNative: true,
    reason: 'no changed paths were available; running the full native matrix',
  });
});

test('fails closed for unknown paths', () => {
  assert.equal(classifyCiChanges(['tools/new-helper.ts']).runNative, true);
});
