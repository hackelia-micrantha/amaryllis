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

test('change classifier activates the project toolchain before Node entrypoints', () => {
  const changes = jobBlock('changes');

  assertContainsAll(changes, [
    'nix flake check',
    'nix build --no-link --print-out-paths .#ci-toolchain',
    'printf \'%s\\n\' "$toolchain/bin" >> "$GITHUB_PATH"',
    'node --test',
    'node scripts/detect-ci-changes.mjs',
  ]);
  assert.ok(
    changes.indexOf('nix build --no-link --print-out-paths .#ci-toolchain') <
      changes.indexOf('node --test'),
    'change classifier must activate the project toolchain before invoking Node',
  );
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
  ]);
});

test('root library job retains the stable build boundary', () => {
  const block = jobBlock('build-library');

  assertContainsAll(block, [
    'needs: [changes, components-package]',
    "if: needs.changes.outputs.run_root != 'true'",
    "if: needs.changes.outputs.run_root == 'true'",
    'run: yarn prepare',
  ]);
});

test('package preflight validates the complete publishable DAG in one checkout', () => {
  const block = jobBlock('package-preflight');

  assertContainsAll(block, [
    'needs: [changes, lint, test, components-package]',
    "if: needs.changes.outputs.run_root == 'true' || needs.changes.outputs.run_components == 'true'",
    'uses: ./.github/actions/setup',
    'node --test scripts/package-release.test.mjs',
    'yarn workspace @micrantha/amaryllis typecheck',
    'yarn workspace @micrantha/amaryllis build',
    'run: yarn prepare',
    'yarn workspace @micrantha/amaryllis-components build',
    'node scripts/validate-packages.mjs',
    'node scripts/package-preflight.mjs --output-dir package-artifacts',
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

test('hosted iOS bootstrap stays separate from the self-hosted Nix boundary', () => {
  const ios = jobBlock('build-ios');
  assertContainsAll(ios, [
    'runs-on: macos-15',
    'uses: actions/setup-node@v7',
    'node-version-file: .nvmrc',
    'node .yarn/releases/yarn-3.6.1.cjs install --immutable',
    'node .yarn/releases/yarn-3.6.1.cjs turbo run build:ios',
  ]);
  assert.doesNotMatch(ios, /uses: \.\/\.github\/actions\/setup|nix flake check|nix build/);

  for (const name of [
    'changes',
    'lint',
    'test',
    'components-package',
    'build-library',
    'package-preflight',
    'build-android',
  ]) {
    assert.doesNotMatch(
      jobBlock(name),
      /actions\/setup-node@/,
      `${name} must not bypass the self-hosted Nix toolchain`,
    );
  }
});

test('release workflows preflight on project runners and publish exact artifacts on hosted runners', () => {
  for (const path of [
    '.github/workflows/publish.yml',
    '.github/workflows/canary-publish.yml',
  ]) {
    const source = actionSources.get(path);
    assert.ok(source, `missing ${path}`);
    assertContainsAll(source, [
      'preflight:',
      'runs-on: runner-amaryllis',
      'node scripts/package-preflight.mjs',
      'actions/upload-artifact@v7',
      'publish:',
      'runs-on: ubuntu-latest',
      'actions/setup-node@v7',
      'actions/download-artifact@v7',
      'node scripts/publish-package-artifacts.mjs',
    ]);
    assert.ok(
      source.indexOf('node scripts/package-preflight.mjs') <
        source.indexOf('runs-on: ubuntu-latest'),
      `${path} must create artifacts before crossing to hosted publication`,
    );
  }
});

test('Nix and hosted-native Node contracts retain the same major', () => {
  const flake = readFileSync('flake.nix', 'utf8');
  const nvmrc = readFileSync('.nvmrc', 'utf8').trim();

  assert.match(flake, /nodejs_24\b/);
  assert.match(nvmrc, /^v24(?:\.|$)/);
});

test('shared setup has no hosted or caller-controlled toolchain bypass', () => {
  const setup = actionSources.get('.github/actions/setup/action.yml');
  assert.ok(setup, 'missing composite setup action');
  assert.doesNotMatch(setup, /actions\/setup-node@/);
  assert.doesNotMatch(setup, /activate-nix-toolchain|hosted native|\.yarn\/releases/);
  assert.match(setup, /nix flake check/);
  assert.match(setup, /nix build --no-link --print-out-paths \.#ci-toolchain/);
  assert.match(setup, /yarn install --immutable/);
});

test('SBOM schema validation uses an executable pinned flake validator without Docker', () => {
  const flake = readFileSync('flake.nix', 'utf8');
  const validator = readFileSync('scripts/validate-cyclonedx-schema.sh', 'utf8');

  assertContainsAll(flake, [
    'cyclonedxVersion = "0.32.0"',
    'asset = "cyclonedx-linux-x64"',
    'hash = "sha256-RUh55qSkBcihO/9JuJgq3LBZbzAZsmsIEcZuTX8Hg+E="',
    'cyclonedxLinuxLoader =',
    'pkgs.stdenv.cc.bintools.dynamicLinker',
    'cyclonedxLinuxRPath =',
    'pkgs.lib.makeLibraryPath [',
    'pkgs.stdenv.cc.cc.lib',
    'pkgs.stdenv.cc.libc',
    'pkgs.icu',
    'pkgs.krb5',
    'pkgs.openssl',
    'pkgs.zlib',
    'nativeBuildInputs = pkgs.lib.optional (cyclonedxLinuxLoader != null) pkgs.patchelf',
    'install -Dm755 ${cyclonedxSource} "$out/bin/cyclonedx"',
    '--set-interpreter "${cyclonedxLinuxLoader}"',
    '--set-rpath "${cyclonedxLinuxRPath}"',
    'cyclonedx-validator = cyclonedxValidator',
  ]);
  assert.match(
    flake,
    /CycloneDX\/cyclonedx-cli\/releases\/download\/v\$\{cyclonedxVersion\}/,
  );
  assert.doesNotMatch(flake, /pkgs\.cyclonedx-cli\b|cyclonedx-linux-musl-x64/);
  assert.doesNotMatch(flake, /libexec\/cyclonedx|printf '%s\\n'/);
  assert.match(
    validator,
    /nix build --no-link --print-out-paths \.#cyclonedx-validator/,
  );
  assert.match(validator, /"\$cyclonedx" --version >\/dev\/null/);
  assert.match(validator, /\[\[ -L "\$sbom_file" \]\]/);
  assert.match(validator, /--input-file "\$absolute_file"/);
  assert.match(validator, /"\$cyclonedx" validate/);
  assert.doesNotMatch(validator, /\bdocker\b/i);
});

test('workflow actions use current releases and repository tooling uses Nix', () => {
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
