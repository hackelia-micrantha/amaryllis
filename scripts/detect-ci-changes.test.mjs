import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { detectCiChanges, formatGithubOutputs, formatJobSummary } from './detect-ci-changes.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(repo, path, content = path) {
  const absolute = join(repo, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, content);
}

function commit(repo, message) {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function createRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'amaryllis-ci-detect-'));
  git(repo, 'init', '--quiet');
  git(repo, 'config', 'user.name', 'CI Test');
  git(repo, 'config', 'user.email', 'ci@example.invalid');
  write(repo, 'README.md', 'base');
  const baseSha = commit(repo, 'base');
  return { repo, baseSha };
}

function withRepo(callback) {
  const fixture = createRepo();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.repo, { recursive: true, force: true });
  }
}

function dims(result) {
  return {
    runRoot: result.runRoot,
    runComponents: result.runComponents,
    runNative: result.runNative,
  };
}

const cases = [
  ['docs-only', ['docs/guide.md'], { runRoot: false, runComponents: false, runNative: false }],
  ['root-only', ['src/index.ts'], { runRoot: true, runComponents: false, runNative: true }],
  [
    'components-only',
    ['packages/amaryllis-components/src/index.ts'],
    { runRoot: false, runComponents: true, runNative: false },
  ],
  [
    'native-only',
    ['example/android/Module.kt'],
    { runRoot: true, runComponents: false, runNative: true },
  ],
  [
    'mixed root-components',
    ['src/index.ts', 'packages/amaryllis-components/src/index.ts'],
    { runRoot: true, runComponents: true, runNative: true },
  ],
  [
    'mixed components-native',
    ['packages/amaryllis-components/src/index.ts', 'example/ios/Module.swift'],
    { runRoot: true, runComponents: true, runNative: true },
  ],
  ['lockfile', ['yarn.lock'], { runRoot: true, runComponents: true, runNative: true }],
  [
    'workflow',
    ['.github/workflows/ci.yml'],
    { runRoot: true, runComponents: true, runNative: true },
  ],
  ['unknown', ['tools/new-helper.ts'], { runRoot: true, runComponents: true, runNative: true }],
];

for (const [name, paths, expected] of cases) {
  test(`detects ${name} changes`, () => {
    withRepo(({ repo, baseSha }) => {
      for (const path of paths) write(repo, path, 'changed');
      const headSha = commit(repo, name);
      assert.deepEqual(dims(detectCiChanges({ cwd: repo, baseSha, headSha })), expected);
    });
  });
}

test('relevant-to-docs rename remains relevant because rename detection is disabled', () => {
  withRepo(({ repo }) => {
    write(repo, 'src/old.ts', 'export {};');
    const baseSha = commit(repo, 'root base');
    mkdirSync(join(repo, 'docs'), { recursive: true });
    renameSync(join(repo, 'src/old.ts'), join(repo, 'docs/old.ts'));
    const headSha = commit(repo, 'rename root to docs');
    const result = detectCiChanges({ cwd: repo, baseSha, headSha });

    assert.deepEqual(dims(result), { runRoot: true, runComponents: false, runNative: true });
    assert.deepEqual(result.paths.sort(), ['docs/old.ts', 'src/old.ts']);
  });
});

test('handles unusual filenames without splitting or output injection', () => {
  withRepo(({ repo, baseSha }) => {
    const paths = [
      'docs/file with spaces.md',
      'docs/file\twith-tab.md',
      'docs/file\nwith-newline.md',
      'docs/[glob]*?.md',
      '-leading-dash.md',
    ];
    for (const path of paths) write(repo, path, 'safe');
    const headSha = commit(repo, 'unusual paths');
    const result = detectCiChanges({ cwd: repo, baseSha, headSha });
    const output = formatGithubOutputs(result);

    assert.deepEqual(dims(result), { runRoot: false, runComponents: false, runNative: false });
    assert.deepEqual(result.paths.sort(), paths.sort());
    assert.equal(output.match(/^run_root=/gm)?.length, 1);
    assert.equal(output.match(/^run_components=/gm)?.length, 1);
    assert.equal(output.match(/^run_native=/gm)?.length, 1);
    assert.doesNotMatch(output, /docs\/file/);
  });
});

test('invalid refs and missing revisions fail closed', () => {
  withRepo(({ repo, baseSha }) => {
    for (const result of [
      detectCiChanges({ cwd: repo, baseSha, headSha: 'missing-ref' }),
      detectCiChanges({ baseSha: '', headSha: '' }),
    ]) {
      assert.deepEqual(dims(result), { runRoot: true, runComponents: true, runNative: true });
      assert.deepEqual(result.paths, []);
    }
  });
});

test('formats stable outputs and an auditable escaped summary', () => {
  const result = {
    runRoot: false,
    runComponents: true,
    runNative: false,
    reason: 'affected CI dimensions: components',
    paths: ['docs/file\nwith-`backtick`.md'],
  };
  const output = formatGithubOutputs(result);
  const summary = formatJobSummary(result);

  assert.match(output, /^run_root=false$/m);
  assert.match(output, /^run_components=true$/m);
  assert.match(output, /^run_native=false$/m);
  assert.match(output, /^changed_count=1$/m);
  assert.match(summary, /Root validation: \*\*skipped\*\*/);
  assert.match(summary, /Components validation: \*\*run\*\*/);
  assert.match(summary, /Native matrix: \*\*skipped\*\*/);
  assert.match(summary, /"docs\/file\\nwith-\\u0060backtick\\u0060\.md"/);
  assert.doesNotMatch(summary, /with-`backtick`/);
});
