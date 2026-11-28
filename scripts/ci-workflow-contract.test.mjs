import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

test('compatibility and SBOM jobs cancel only superseded PR runs', () => {
  const expected = [
    'concurrency:',
    "  group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.event.pull_request.number || github.run_id }}",
    "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  ].join('\n');

  for (const name of ['compat-matrix.yml', 'sbom.yml']) {
    const source = actionSources.get(`.github/workflows/${name}`);
    assert.ok(source, `missing ${name}`);
    const header = source.slice(0, source.indexOf('jobs:'));
    assert.equal(
      (header.match(/^concurrency:$/gm) || []).length,
      1,
      `${name} must declare workflow concurrency exactly once`,
    );
    assert.ok(
      header.includes(`\n${expected}\n`),
      `${name} must have workflow-level per-PR cancellation`,
    );
    assert.doesNotMatch(
      header,
      /cancel-in-progress:\s*true\b/,
      `${name} must not cancel release, main, or manual runs`,
    );
  }

  const sbom = actionSources.get('.github/workflows/sbom.yml');
  assert.match(sbom, /push:\n    branches:\n      - main/);
  assert.match(sbom, /tags:\n      - 'v\*'/);
});

function splitUsesScalar(raw, path, lineNumber) {
  let quote = null;
  let commentIndex = -1;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];

    if (quote === "'") {
      if (character === "'" && raw[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        quote = null;
      }
      continue;
    }

    if (quote === '"') {
      if (character === '\\') {
        index += 1;
      } else if (character === '"') {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }

    if (character === '#') {
      commentIndex = index;
      break;
    }
  }

  assert.equal(quote, null, `${path}:${lineNumber} has an unterminated quoted uses value`);

  const valuePart = (commentIndex === -1 ? raw : raw.slice(0, commentIndex)).trim();
  const comment = commentIndex === -1 ? '' : raw.slice(commentIndex + 1).trim();

  assert.ok(valuePart, `${path}:${lineNumber} has an empty uses value`);
  assert.ok(!['|', '>'].includes(valuePart[0]), `${path}:${lineNumber} uses multiline uses syntax`);

  let value = valuePart;
  if (valuePart.startsWith("'")) {
    assert.ok(valuePart.endsWith("'"), `${path}:${lineNumber} has malformed single-quoted uses syntax`);
    value = valuePart.slice(1, -1).replaceAll("''", "'");
  } else if (valuePart.startsWith('"')) {
    assert.ok(valuePart.endsWith('"'), `${path}:${lineNumber} has malformed double-quoted uses syntax`);
    value = JSON.parse(valuePart);
  }

  return { value, comment };
}

function extractUsesReferences(source, path) {
  const references = [];

  for (const [index, line] of source.split('\n').entries()) {
    const trimmed = line.trimStart();
    // YAML permits quoted keys and spaces before ':'. Reject such uses keys
    // rather than silently skipping mutable action references.
    const possibleUsesKey = /(?:^|[\s{[,])(?:uses|"uses"|'uses')\s*:/;
    if (!trimmed || trimmed.startsWith('#') || !possibleUsesKey.test(trimmed)) {
      continue;
    }

    const match = line.match(/^\s*(?:-\s*)?uses:\s*(.+?)\s*$/);
    assert.ok(match, `${path}:${index + 1} uses unsupported YAML uses syntax`);

    references.push({
      ...splitUsesScalar(match[1], path, index + 1),
      lineNumber: index + 1,
    });
  }

  // Parse YAML independently to detect references the comment-preserving
  // line scanner cannot recognize, including escaped keys and aliases.
  const parsed = JSON.parse(execFileSync('yq', [
    'eval', '-o=json', '-I=0', 'explode(.)', '-',
  ], { input: source, encoding: 'utf8' }));
  const semanticReferences = [];
  function visit(node) {
    if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node !== null && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'uses') {
          assert.equal(typeof value, 'string', path + ': uses must be a scalar string');
          semanticReferences.push(value);
        } else {
          visit(value);
        }
      }
    }
  }
  visit(parsed);
  assert.deepEqual(
    references.map(reference => reference.value).sort(),
    semanticReferences.sort(),
    path + ': unsupported YAML uses syntax or ambiguous action references',
  );
  return references;
}

test('unsupported YAML uses key shapes fail closed', () => {
  for (const key of ['"uses"', "'uses'", 'uses ']) {
    const fixture = `- ${key}: actions/checkout@v7`;
    assert.throws(
      () => extractUsesReferences(fixture, 'fixture.yml'),
      /unsupported YAML uses syntax/,
      `unsupported key encoding must not bypass immutable pin verification: ${key}`,
    );
  }
  assert.throws(
    () => extractUsesReferences('- {uses: actions/checkout@v7}', 'fixture.yml'),
    /unsupported YAML uses syntax/,
  );
  assert.throws(
    () => extractUsesReferences('- "u\\u0073es": actions/checkout@v7', 'fixture.yml'),
    /unsupported YAML uses syntax/,
  );
  assert.throws(
    () => extractUsesReferences('steps:\n  - &step\n    uses: actions/checkout@v7\n  - *step', 'fixture.yml'),
    /unsupported YAML uses syntax/,
  );
  assert.equal(
    extractUsesReferences('  - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567 # v7', 'fixture.yml').length,
    1,
  );
});

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
  for (const name of ['lint']) {
    const block = jobBlock(name);
    assertContainsAll(block, [
      'needs: changes',
      "if: needs.changes.outputs.run_root != 'true'",
      "if: needs.changes.outputs.run_root == 'true'",
      'uses: ./.github/actions/setup',
    ]);
  }
});

test('PR root tests and coverage use a single read-only execution', () => {
  const root = jobBlock('test');
  assertContainsAll(root, [
    'needs: changes',
    "github.event_name == 'pull_request' || needs.changes.result == 'success'",
    "if: github.event_name != 'pull_request' && needs.changes.outputs.run_root == 'true'",
    "if: github.event_name == 'pull_request'",
    'yarn test --maxWorkers=2 --coverage',
    'Validate coverage thresholds',
    "MIN_LINES: '76'",
    "MIN_STATEMENTS: '76'",
    "MIN_FUNCTIONS: '77'",
    "MIN_BRANCHES: '63'",
    'persist-credentials: false',
    'uses: ./.github/actions/setup',
  ]);
  assert.doesNotMatch(root, /pull-requests: write/);
  const report = jobBlock('coverage-report');
  assertContainsAll(report, ['needs: test', 'pull-requests: write', 'COVERAGE_COMMENT:', 'JSON.parse(process.env.COVERAGE_COMMENT)']);
  assert.doesNotMatch(report, /actions\/checkout|\.\/\.github\/actions\/setup|yarn test/);
  assert.equal(actionSources.has('.github/workflows/coverage-gate.yml'), false);
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

test('Android bootstrap is owned by the repository flake', () => {
  const android = jobBlock('build-android');
  const flake = readFileSync('flake.nix', 'utf8');
  const androidGradle = readFileSync('android/build.gradle', 'utf8');

  assertContainsAll(android, [
    'nix build --no-link --print-out-paths .#android-ci-toolchain',
    'ANDROID_HOME=$toolchain/android-sdk',
    'ANDROID_SDK_ROOT=$toolchain/android-sdk',
    'android-sdk/platforms/android-35',
    'android-sdk/build-tools/35.0.0',
    'android-sdk/ndk/27.1.12297006',
    'grep -Eq',
    "hashFiles('yarn.lock', 'flake.nix', 'flake.lock'",
  ]);
  const turboCacheBlock = android.split('      - name: Cache turborepo for Android')[1]
    ?.split('      - name: Check turborepo cache for Android')[0];
  assert.ok(turboCacheBlock, 'missing Android Turbo cache step');
  assert.doesNotMatch(
    turboCacheBlock,
    /restore-keys:/,
    'Android toolchain changes must never restore previous Gradle output',
  );
  assert.doesNotMatch(android, /actions\/setup-java@|android-actions\/setup-android@/);

  assertContainsAll(flake, [
    'pkgs.gh',
    'android_sdk.accept_license = true',
    'toolsVersion = null',
    'platformVersions = [ "35" ]',
    'buildToolsVersions = [ ]',
    'androidBuildToolsComposition."build-tools"',
    'overrideAttrs',
    'androidBuildTools',
    'includeCmake = true',
    'cmakeVersions = [ "3.22.1" ]',
    'includeNDK = true',
    'ndkVersions = [ "27.1.12297006" ]',
    'android-ci-toolchain = androidCiToolchain',
    'androidPkgs.jdk21',
  ]);

  assertContainsAll(androidGradle, [
    'sourceCompatibility JavaVersion.VERSION_1_8',
    'targetCompatibility JavaVersion.VERSION_1_8',
    'javaLauncher = javaToolchains.launcherFor',
    'languageVersion = JavaLanguageVersion.of(21)',
  ]);
});

test('workflow lint uses the repository toolchain without a container action', () => {
  const lintWorkflow = actionSources.get('.github/workflows/workflow-lint.yml');
  const flake = readFileSync('flake.nix', 'utf8');

  assert.ok(lintWorkflow, 'missing workflow lint workflow');
  assert.match(lintWorkflow, /nix build --no-link --print-out-paths \.#ci-toolchain/);
  assert.match(lintWorkflow, /(?:^|\n)\s+actionlint(?:\s|$)/);
  assert.doesNotMatch(lintWorkflow, /reviewdog\/action-actionlint|docker/);
  assert.match(flake, /pkgs\.actionlint/);
});

test('hosted iOS bootstrap stays separate from the self-hosted Nix boundary', () => {
  const ios = jobBlock('build-ios');
  assertContainsAll(ios, [
    'runs-on: macos-15',
    'node-version-file: .nvmrc',
    'node .yarn/releases/yarn-3.6.1.cjs install --immutable',
    'node .yarn/releases/yarn-3.6.1.cjs turbo run build:ios',
  ]);
  assert.match(ios, /uses: actions\/setup-node@[0-9a-f]{40} # \S+/);
  assert.doesNotMatch(ios, /uses: \.\/\.github\/actions\/setup|nix flake check|nix build/);

  for (const name of ['changes', 'lint', 'test', 'components-package', 'build-library', 'build-android']) {
    assert.doesNotMatch(
      jobBlock(name),
      /actions\/setup-node@/,
      `${name} must not bypass the self-hosted Nix toolchain`,
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

// Preserve the existing action-version floors independently of exact pins.
// Version comments are reviewed metadata, not cryptographic tag attestations.
const actionMajorFloors = new Map([
  ['actions/checkout', 7],
  ['actions/setup-node', 7],
  ['actions/cache', 5],
  ['actions/setup-java', 5],
  ['actions/upload-artifact', 7],
  ['actions/github-script', 9],
  ['github/codeql-action', 4],
  ['android-actions/setup-android', 4],
]);

function assertSupportedActionVersion(value, comment, location) {
  const repository = value.split('@')[0].split('/').slice(0, 2).join('/').toLowerCase();
  assert.notEqual(repository, 'marocchino/sticky-pull-request-comment',
    location + ' must not reintroduce the replaced coverage-comment action');
  const floor = actionMajorFloors.get(repository);
  if (floor === undefined) {
    return;
  }

  const major = /^v(\d+)(?:\.\d+)*(?:\s|$)/.exec(comment);
  assert.ok(major && Number(major[1]) >= floor,
    location + ' must declare supported ' + repository + ' version >= v' + floor);
}

function assertImmutableReferences(source, path) {
  const actionRef = /^[^@\s]+@[0-9a-f]{40}$/;
  const dockerRef = /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/;
  for (const { value, comment, lineNumber } of extractUsesReferences(source, path)) {
    if (value.startsWith('./')) {
      continue;
    }

    assert.match(
      value,
      value.startsWith('docker://') ? dockerRef : actionRef,
      path + ':' + lineNumber + ' must pin external uses to an immutable commit SHA or image digest',
    );
    assert.ok(
      comment && /\d/.test(comment),
      path + ':' + lineNumber + ' must include a readable upstream version/revision comment',
    );
    assertSupportedActionVersion(value, comment, path + ':' + lineNumber);
  }
}

test('immutable references reject mutable action and image versions', () => {
  for (const value of ['actions/checkout@v7', 'actions/checkout@main', 'docker://alpine:latest']) {
    assert.throws(
      () => assertImmutableReferences('- uses: ' + value + ' # v7', 'fixture.yml'),
      /must pin external uses/,
    );
  }
  assertImmutableReferences('- uses: ./.github/actions/setup', 'fixture.yml');
  assertImmutableReferences('- uses: actions/checkout@0123456789abcdef0123456789abcdef01234567 # v7', 'fixture.yml');
  assertImmutableReferences('- uses: docker://alpine@sha256:' + 'a'.repeat(64) + ' # 3.22', 'fixture.yml');
});

test('immutable action pins retain existing version floors and exclusions', () => {
  const sha = 'a'.repeat(40);
  for (const [repository, floor] of actionMajorFloors) {
    const action = repository === 'github/codeql-action' ? repository + '/init' : repository;
    assert.throws(
      () => assertImmutableReferences('- uses: ' + action + '@' + sha + ' # v' + (floor - 1), 'fixture.yml'),
      /must declare supported/,
    );
    assert.throws(
      () => assertImmutableReferences('- uses: ' + action + '@' + sha + ' # release 2026', 'fixture.yml'),
      /must declare supported/,
    );
    assertImmutableReferences('- uses: ' + action + '@' + sha + ' # v' + floor + '.0.0', 'fixture.yml');
    assertImmutableReferences('- uses: ' + action + '@' + sha + ' # v' + (floor + 1), 'fixture.yml');
  }
  assert.throws(
    () => assertImmutableReferences('- uses: marocchino/sticky-pull-request-comment@' + sha + ' # v2', 'fixture.yml'),
    /must not reintroduce/,
  );
});

test('external workflow and composite-action references are immutable', () => {
  for (const [path, source] of actionSources) {
    assertImmutableReferences(source, path);
  }
  assert.match(jobBlock('coverage-report'), /actions\/github-script@[0-9a-f]{40} # \S+/);

  const sbom = actionSources.get('.github/workflows/sbom.yml');
  assert.ok(sbom, 'missing SBOM workflow');
  assert.match(
    sbom,
    /actions\/checkout@[0-9a-f]{40} # \S+/,
  );
  assert.match(
    sbom,
    /actions\/upload-artifact@[0-9a-f]{40} # \S+/,
  );
});
