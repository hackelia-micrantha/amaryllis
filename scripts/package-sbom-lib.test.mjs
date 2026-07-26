import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { derivePackageSboms, parseYarnLock } from './package-sbom-lib.mjs';

const fixtureDir = new URL('./__fixtures__/package-sbom/', import.meta.url);
const source = JSON.parse(fs.readFileSync(new URL('source.cdx.json', fixtureDir), 'utf8'));
const packageSpecs = JSON.parse(fs.readFileSync(new URL('manifests.json', fixtureDir), 'utf8'));
const lockText = fs.readFileSync(new URL('yarn.lock', fixtureDir), 'utf8');
const expectedBytesBySlug = new Map(
  packageSpecs.map(({ slug }) => [
    slug,
    fs.readFileSync(new URL(`expected/${slug}.cdx.json`, fixtureDir), 'utf8'),
  ])
);

function derive(overrides = {}) {
  return derivePackageSboms({ source, packageSpecs, lockText, ...overrides });
}

test('derives exact published identity, production closure, peers, and workspace dependencies', () => {
  const [{ output }] = derive();
  const root = output.metadata.component;
  assert.deepEqual(root, {
    type: 'library',
    name: '@fixture/root',
    version: '1.2.3',
    purl: 'pkg:npm/%40fixture/root@1.2.3',
    'bom-ref': 'pkg:npm/%40fixture/root@1.2.3',
  });

  const byName = new Map(output.components.map((component) => [component.name, component]));
  assert.equal(byName.get('direct').version, '1.0.0');
  assert.equal(byName.get('transitive').version, '2.0.0');
  assert.equal(byName.get('@fixture/workspace').version, '4.5.6');
  assert.equal(byName.get('workspace-direct').version, '5.0.0');
  assert.equal(byName.get('peer').scope, 'optional');
  assert.deepEqual(byName.get('peer').properties, [
    { name: 'cdx:npm:dependencyType', value: 'peer' },
  ]);
  assert.equal(byName.has('dev-only'), false);

  const graph = new Map(output.dependencies.map((dependency) => [dependency.ref, dependency.dependsOn]));
  assert.deepEqual(graph.get('pkg:npm/direct@1.0.0'), ['pkg:npm/transitive@2.0.0']);
  assert.deepEqual(graph.get('pkg:npm/%40fixture/workspace@4.5.6'), [
    'pkg:npm/workspace-direct@5.0.0',
  ]);
});

test('fails closed for duplicate or missing lockfile resolutions', () => {
  assert.throws(
    () => parseYarnLock(`${lockText}\n"direct@npm:^1.0.0":\n  version: 9.9.9\n`),
    /duplicate descriptor direct@npm:\^1\.0\.0/
  );

  const missing = lockText.replace(/"transitive@npm:\^2\.0\.0":[\s\S]*?(?=\n"workspace-direct)/, '');
  assert.throws(
    () => derive({ lockText: missing }),
    /no exact resolution for transitive@npm:\^2\.0\.0/
  );
});

test('matches committed byte-for-byte golden outputs', () => {
  for (const { slug, bytes } of derive()) {
    assert.equal(bytes, expectedBytesBySlug.get(slug), `${slug} SBOM changed unexpectedly`);
  }
});

test('produces stable output regardless of synthetic input ordering', () => {
  const reordered = derive({
    source: { ...source, components: [...source.components].reverse() },
    packageSpecs: [...packageSpecs].reverse(),
  });

  for (const { slug, output, bytes } of reordered) {
    assert.equal(bytes, expectedBytesBySlug.get(slug));
    assert.deepEqual(
      output.components.map((component) => component['bom-ref']),
      output.components.map((component) => component['bom-ref']).toSorted()
    );
    assert.deepEqual(
      output.dependencies.map((dependency) => dependency.ref),
      output.dependencies.map((dependency) => dependency.ref).toSorted()
    );
  }
});
