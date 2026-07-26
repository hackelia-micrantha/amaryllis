import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

function jobBlock(name) {
  const marker = `  ${name}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name} job`);

  const nextJob = workflow.indexOf('\n  ', start + marker.length);
  return nextJob === -1 ? workflow.slice(start) : workflow.slice(start, nextJob);
}

function assertContainsAll(block, snippets) {
  for (const snippet of snippets) {
    assert.match(block, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

test('change classifier exposes every CI dimension', () => {
  const changes = jobBlock('changes');

  assertContainsAll(changes, [
    'run_root: ${{ steps.classify.outputs.run_root }}',
    'run_components: ${{ steps.classify.outputs.run_components }}',
    'run_native: ${{ steps.classify.outputs.run_native }}',
  ]);
});

test('stable root jobs retain lightweight and expensive paths', () => {
  for (const name of ['lint', 'test']) {
    const block = jobBlock(name);
    assertContainsAll(block, [
      'needs: changes',
      "if: needs.changes.outputs.run_root != 'true'",
      "if: needs.changes.outputs.run_root == 'true'",
      'uses: ./.github/actions/setup',
    ]);
  }
});

test('components job retains stable acknowledgement and validation paths', () => {
  const block = jobBlock('components-package');

  assertContainsAll(block, [
    'needs: changes',
    "if: needs.changes.outputs.run_components != 'true'",
    "if: needs.changes.outputs.run_components == 'true'",
    'yarn workspace @micrantha/amaryllis-components test --runInBand',
    'yarn workspace @micrantha/amaryllis-components typecheck',
    'yarn workspace @micrantha/amaryllis-components build',
    'npm pack --dry-run',
  ]);
});

test('root library job independently validates package outputs', () => {
  const block = jobBlock('build-library');

  assertContainsAll(block, [
    'needs: [changes, components-package]',
    "if: needs.changes.outputs.run_root != 'true'",
    "if: needs.changes.outputs.run_root == 'true'",
    'run: yarn prepare',
    'run: node scripts/validate-packages.mjs',
    'run: npm pack --dry-run',
  ]);
});

test('native jobs remain controlled by the native dimension', () => {
  for (const name of ['build-android', 'build-ios']) {
    const block = jobBlock(name);
    assertContainsAll(block, [
      'needs: changes',
      "if: needs.changes.outputs.run_native == 'true'",
    ]);
  }
});
