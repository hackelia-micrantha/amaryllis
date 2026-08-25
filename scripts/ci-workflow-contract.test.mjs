import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/primary-ci.yml', 'utf8');
const lines = workflow.split('\n');
const jobsStart = lines.findIndex(line => line === 'jobs:');

assert.notEqual(jobsStart, -1, 'missing jobs section');

function jobBlock(name) {
  const marker = `  ${name}:`;
  const start = lines.findIndex((line, index) => index > jobsStart && line === marker);
  assert.notEqual(start, -1, `missing ${name} job`);

  const relativeEnd = lines
    .slice(start + 1)
    .findIndex(line => /^  [A-Za-z0-9_-]+:$/.test(line));
  const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;

  return lines.slice(start, end).join('\n');
}

function assertContainsAll(block, snippets) {
  for (const snippet of snippets) {
    assert.match(block, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

function collectYamlFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectYamlFiles(path));
    } else if (/\.ya?ml$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

const actionSources = new Map(
  [
    ...collectYamlFiles('.github/workflows'),
    ...collectYamlFiles('.github/actions'),
  ].map(path => [relative('.', path), readFileSync(path, 'utf8')]),
);

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

test('Linux Node toolchains are owned by the repository flake', () => {
  const setup = actionSources.get('.github/actions/setup/action.yml');
  assert.ok(setup, 'missing composite setup action');
  assert.match(
    setup,
    /nix develop "\$GITHUB_WORKSPACE#\$\{NIX_SHELL\}" --command corepack yarn install --immutable/,
  );
  assert.match(
    setup,
    /exec nix develop "\$GITHUB_WORKSPACE#\$\{NIX_SHELL\}" --command \$tool/,
  );

  const compatibility = actionSources.get('.github/workflows/compat-matrix.yml');
  assert.ok(compatibility, 'missing Node compatibility workflow');
  assertContainsAll(compatibility, [
    'nix-shell: node20',
    'nix-shell: node22',
    'nix-shell: node24',
    'nix develop ".#${NIX_SHELL}" --command node --version',
    'nix develop ".#${NIX_SHELL}" --command corepack yarn test --maxWorkers=2',
    'nix develop ".#${NIX_SHELL}" --command corepack yarn typecheck',
  ]);
});

test('workflow actions use Node 24-compatible releases', () => {
  const obsoleteActions = [
    ['actions/checkout', /actions\/checkout@(?:v[1-6]\b|[0-9a-f]{40}\s+# v[1-6](?:\.\d+\.\d+)?\b)/],
    ['actions/setup-node', /actions\/setup-node@v[1-6]\b/],
    ['actions/cache', /actions\/cache@v[1-4]\b/],
    ['actions/setup-java', /actions\/setup-java@v[1-4]\b/],
    ['actions/upload-artifact', /actions\/upload-artifact@(?:v[1-6]\b|[0-9a-f]{40}\s+# v[1-6](?:\.\d+\.\d+)?\b)/],
    ['actions/github-script', /actions\/github-script@v[1-8]\b/],
    ['github/codeql-action', /github\/codeql-action\/(?:init|autobuild|analyze)@v[1-3]\b/],
    ['android-actions/setup-android', /android-actions\/setup-android@v[1-3]\b/],
    ['marocchino/sticky-pull-request-comment', /marocchino\/sticky-pull-request-comment@/],
  ];

  for (const [path, source] of actionSources) {
    for (const [action, pattern] of obsoleteActions) {
      assert.doesNotMatch(source, pattern, `${path} uses an obsolete ${action} release`);
    }
  }

  const setup = actionSources.get('.github/actions/setup/action.yml');
  assert.ok(setup, 'missing composite setup action');
  assert.match(setup, /actions\/setup-node@v7\b/);

  const coverage = actionSources.get('.github/workflows/coverage-gate.yml');
  assert.ok(coverage, 'missing coverage workflow');
  assert.match(coverage, /actions\/github-script@v9\b/);

  const sbom = actionSources.get('.github/workflows/sbom.yml');
  assert.ok(sbom, 'missing SBOM workflow');
  assert.match(
    sbom,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/,
  );
  assert.match(
    sbom,
    /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7\.0\.1/,
  );
});
