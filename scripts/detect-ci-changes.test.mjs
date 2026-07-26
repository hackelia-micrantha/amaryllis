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

test('detects documentation-only changes as non-native', () => {
  withRepo(({ repo, baseSha }) => {
    write(repo, 'docs/guide.md', 'guide');
    const headSha = commit(repo, 'docs');
    const result = detectCiChanges({ cwd: repo, baseSha, headSha });

    assert.equal(result.runNative, false);
    assert.deepEqual(result.paths, ['docs/guide.md']);
  });
});

test('detects components-only changes as non-native', () => {
  withRepo(({ repo, baseSha }) => {
    write(repo, 'packages/amaryllis-components/src/index.ts', 'export {};');
    const headSha = commit(repo, 'components');

    assert.equal(detectCiChanges({ cwd: repo, baseSha, headSha }).runNative, false);
  });
});

test('detects shared and deleted native files as native-relevant', () => {
  withRepo(({ repo }) => {
    write(repo, 'src/index.ts', 'export {};');
    write(repo, 'example/android/Module.kt', 'class Module');
    const baseSha = commit(repo, 'native base');
    rmSync(join(repo, 'example/android/Module.kt'));
    const headSha = commit(repo, 'delete native');
    const result = detectCiChanges({ cwd: repo, baseSha, headSha });

    assert.equal(result.runNative, true);
    assert.deepEqual(result.paths, ['example/android/Module.kt']);
  });
});

test('native-to-docs rename runs the native matrix', () => {
  withRepo(({ repo }) => {
    write(repo, 'example/android/Module.kt', 'class Module');
    const baseSha = commit(repo, 'native base');
    mkdirSync(join(repo, 'docs'), { recursive: true });
    renameSync(join(repo, 'example/android/Module.kt'), join(repo, 'docs/Module.kt'));
    const headSha = commit(repo, 'rename native to docs');
    const result = detectCiChanges({ cwd: repo, baseSha, headSha });

    assert.equal(result.runNative, true);
    assert.deepEqual(result.paths.sort(), ['docs/Module.kt', 'example/android/Module.kt']);
  });
});

test('native-to-components rename runs the native matrix', () => {
  withRepo(({ repo }) => {
    write(repo, 'example/ios/Module.swift', 'struct Module {}');
    const baseSha = commit(repo, 'native base');
    mkdirSync(join(repo, 'packages/amaryllis-components/src'), { recursive: true });
    renameSync(
      join(repo, 'example/ios/Module.swift'),
      join(repo, 'packages/amaryllis-components/src/Module.ts')
    );
    const headSha = commit(repo, 'rename native to components');

    assert.equal(detectCiChanges({ cwd: repo, baseSha, headSha }).runNative, true);
  });
});

test('allowlisted-to-allowlisted rename skips the native matrix', () => {
  withRepo(({ repo }) => {
    write(repo, 'docs/old.md', 'old');
    const baseSha = commit(repo, 'docs base');
    renameSync(join(repo, 'docs/old.md'), join(repo, 'docs/new.md'));
    const headSha = commit(repo, 'rename docs');

    assert.equal(detectCiChanges({ cwd: repo, baseSha, headSha }).runNative, false);
  });
});

test('handles unusual filenames without splitting or interpretation', () => {
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

    assert.equal(result.runNative, false);
    assert.deepEqual(result.paths.sort(), paths.sort());
  });
});

test('invalid refs and unavailable history fail closed', () => {
  withRepo(({ repo, baseSha }) => {
    const result = detectCiChanges({ cwd: repo, baseSha, headSha: 'missing-ref' });

    assert.equal(result.runNative, true);
    assert.equal(result.reason, 'git change detection failed; running the full native matrix');
    assert.deepEqual(result.paths, []);
  });
});

test('missing refs fail closed before invoking git', () => {
  const result = detectCiChanges({ baseSha: '', headSha: '' });

  assert.equal(result.runNative, true);
  assert.match(result.reason, /revision was unavailable/);
});

test('machine outputs cannot be injected by a filename', () => {
  withRepo(({ repo, baseSha }) => {
    write(repo, 'src/file\nrun_native=false', 'unsafe');
    const headSha = commit(repo, 'adversarial filename');
    const result = detectCiChanges({ cwd: repo, baseSha, headSha });
    const output = formatGithubOutputs(result);

    assert.equal(result.runNative, true);
    assert.equal(output.match(/^run_native=/gm)?.length, 1);
    assert.match(output, /^run_native=true$/m);
    assert.doesNotMatch(output, /src\/file/);
    assert.doesNotMatch(output, /^run_native=false$/m);
  });
});

test('formats stable outputs and an auditable escaped summary', () => {
  const result = {
    runNative: false,
    reason: 'all changed paths are explicitly classified as non-native',
    paths: ['docs/file\nwith-`backtick`.md'],
  };
  const summary = formatJobSummary(result);

  assert.match(formatGithubOutputs(result), /^run_native=false\n/m);
  assert.match(formatGithubOutputs(result), /^changed_count=1$/m);
  assert.match(summary, /Native matrix: \*\*skipped\*\*/);
  assert.match(summary, /"docs\/file\\nwith-\\u0060backtick\\u0060\.md"/);
  assert.doesNotMatch(summary, /with-`backtick`/);
});
