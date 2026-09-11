import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertInternalDependencyCompatibility,
  assertRuntimeImportsDeclared,
  materializePublishedManifest,
  satisfiesSimpleRange,
} from './package-release-lib.mjs';

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
