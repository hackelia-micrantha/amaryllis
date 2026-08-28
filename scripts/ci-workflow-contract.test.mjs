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
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('uses:')) {
      continue;
    }

    const match = line.match(/^\s*(?:-\s*)?uses:\s*(.+?)\s*$/);
    assert.ok(match, `${path}:${index + 1} uses unsupported YAML uses syntax`);

    references.push({
      ...splitUsesScalar(match[1], path, index + 1),
      lineNumber: index + 1,
    });
  }

  return references;
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

test('external workflow and composite-action references are immutable', () => {
  const immutableRef = /^[^@\s]+@[0-9a-f]{40}$/;

  for (const [path, source] of actionSources) {
    for (const { value, comment, lineNumber } of extractUsesReferences(source, path)) {
      if (value.startsWith('./')) {
        continue;
      }

      assert.match(
        value,
        immutableRef,
        `${path}:${lineNumber} must pin external uses to a full 40-character commit SHA`,
      );
      assert.ok(
        comment && /\d/.test(comment),
        `${path}:${lineNumber} must include a readable upstream version/revision comment`,
      );
    }
  }
});
