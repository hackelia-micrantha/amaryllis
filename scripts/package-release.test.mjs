import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertInternalDependencyCompatibility,
  assertRuntimeImportsDeclared,
  materializePublishedManifest,
  satisfiesSimpleRange,
} from './package-release-lib.mjs';

function workflowJobBlock(source, name) {
  const marker = `  ${name}:`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name} job`);
  const rest = source.slice(start + marker.length);
  const nextMatch = rest.match(/\n  [A-Za-z0-9_-]+:\n/);
  const end = nextMatch ? start + marker.length + nextMatch.index : source.length;
  return source.slice(start, end);
}

test('materializes workspace star dependency to the exact released version', () => {
  const manifest = materializePublishedManifest(
    {
      name: '@micrantha/react-native-amaryllis',
      version: '0.1.7',
      workspaces: ['packages/*'],
      dependencies: {
        '@micrantha/amaryllis': 'workspace:*',
      },
    },
    {
      '@micrantha/amaryllis': '0.1.0',
      '@micrantha/react-native-amaryllis': '0.1.7',
    }
  );

  assert.equal(manifest.version, '0.1.7');
  assert.equal(manifest.dependencies['@micrantha/amaryllis'], '0.1.0');
  assert.equal('workspaces' in manifest, false);
});

test('materializes canary workspace dependency to the matching canary artifact', () => {
  const manifest = materializePublishedManifest(
    {
      name: '@micrantha/react-native-amaryllis',
      version: '0.1.7',
      dependencies: {
        '@micrantha/amaryllis': 'workspace:*',
      },
    },
    {
      '@micrantha/amaryllis': '0.1.0-canary.12.abcdef0',
      '@micrantha/react-native-amaryllis': '0.1.7-canary.12.abcdef0',
    }
  );

  assert.equal(
    manifest.dependencies['@micrantha/amaryllis'],
    '0.1.0-canary.12.abcdef0'
  );
});

test('fails when a workspace dependency is not part of the release', () => {
  assert.throws(
    () =>
      materializePublishedManifest(
        {
          name: '@micrantha/react-native-amaryllis',
          version: '0.1.7',
          dependencies: { '@micrantha/missing': 'workspace:*' },
        },
        { '@micrantha/react-native-amaryllis': '0.1.7' }
      ),
    /unpublished workspace dependency/
  );
});

test('fails when built output imports an undeclared runtime package', () => {
  assert.throws(
    () =>
      assertRuntimeImportsDeclared(
        {
          name: '@micrantha/react-native-amaryllis',
          dependencies: { '@micrantha/amaryllis': '0.1.0' },
          peerDependencies: { react: '*' },
        },
        [
          "import React from 'react'; import { x } from '@micrantha/amaryllis'; import { Observable } from 'rxjs';",
        ]
      ),
    /undeclared runtime packages: rxjs/
  );
});

test('accepts declared subpath and node builtin imports', () => {
  assert.doesNotThrow(() =>
    assertRuntimeImportsDeclared(
      {
        name: '@micrantha/react-native-amaryllis',
        dependencies: { '@micrantha/amaryllis': '0.1.0' },
      },
      [
        "const fs = require('node:fs'); export * from '@micrantha/amaryllis/context';",
      ]
    )
  );
});

test('fails an incompatible internal package version relationship', () => {
  assert.throws(
    () =>
      assertInternalDependencyCompatibility({
        '@micrantha/amaryllis': {
          name: '@micrantha/amaryllis',
          version: '0.1.0',
        },
        '@micrantha/react-native-amaryllis': {
          name: '@micrantha/react-native-amaryllis',
          version: '0.1.7',
          dependencies: { '@micrantha/amaryllis': '^0.2.0' },
        },
      }),
    /but the release contains 0.1.0/
  );
});

test('implements the release ranges used by staged package manifests', () => {
  assert.equal(satisfiesSimpleRange('1.3.0', '^1.2.0'), true);
  assert.equal(satisfiesSimpleRange('2.0.0', '^1.2.0'), false);
  assert.equal(satisfiesSimpleRange('0.1.5', '^0.1.0'), true);
  assert.equal(satisfiesSimpleRange('0.2.0', '^0.1.0'), false);
  assert.equal(satisfiesSimpleRange('1.2.9', '~1.2.0'), true);
  assert.equal(satisfiesSimpleRange('1.3.0', '~1.2.0'), false);
  assert.equal(
    satisfiesSimpleRange('0.1.0-canary.1', '^0.1.0'),
    false
  );
});

test('release workflows reserve OIDC authority for hosted publication', () => {
  for (const path of [
    '.github/workflows/publish.yml',
    '.github/workflows/canary-publish.yml',
  ]) {
    const source = readFileSync(path, 'utf8');
    const preflight = workflowJobBlock(source, 'preflight');
    const publish = workflowJobBlock(source, 'publish');

    assert.match(source, /^permissions: \{\}$/m, `${path} must default to no token permissions`);
    assert.match(preflight, /runs-on: runner-amaryllis/);
    assert.match(preflight, /actions: read/);
    assert.match(preflight, /contents: read/);
    assert.doesNotMatch(preflight, /id-token:\s*write/);
    assert.doesNotMatch(preflight, /npm publish/);

    assert.match(publish, /runs-on: ubuntu-latest/);
    assert.match(publish, /id-token: write/);
    assert.match(publish, /actions\/setup-node@v7/);
    assert.match(publish, /package-manager-cache: false/);
    assert.match(publish, /actions\/download-artifact@v7/);
    assert.match(publish, /scripts\/publish-package-artifacts\.mjs/);
  }
});

test('production release gates the checked-out tagged commit inside the project toolchain', () => {
  const source = readFileSync('.github/workflows/publish.yml', 'utf8');
  const preflight = workflowJobBlock(source, 'preflight');
  const setupIndex = preflight.indexOf('uses: ./.github/actions/setup');
  const tagValidationIndex = preflight.indexOf(
    'node scripts/validate-release-tag.mjs'
  );

  assert.notEqual(setupIndex, -1, 'production preflight must activate the project toolchain');
  assert.notEqual(tagValidationIndex, -1, 'production preflight must validate the release tag');
  assert.ok(
    setupIndex < tagValidationIndex,
    'release tag validation must not rely on ambient runner Node'
  );
  assert.match(preflight, /sha=\$\(git rev-parse HEAD\)/);
  assert.match(preflight, /TARGET_SHA: \$\{\{ steps\.target\.outputs\.sha \}\}/);
  assert.doesNotMatch(preflight, /TARGET_SHA: \$\{\{ github\.sha \}\}/);
});
