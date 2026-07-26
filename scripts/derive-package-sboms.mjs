#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [inputPath = 'artifacts/sbom.cdx.json', outputDir = 'artifacts/packages'] =
  process.argv.slice(2);

const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const sourceComponents = Array.isArray(source.components) ? source.components : [];
const sourceDependencies = Array.isArray(source.dependencies) ? source.dependencies : [];
const sourceDependencyByRef = new Map(
  sourceDependencies.map((dependency) => [dependency.ref, dependency.dependsOn ?? []])
);

const packageSpecs = [
  {
    manifestPath: 'package.json',
    slug: 'react-native-amaryllis',
  },
  {
    manifestPath: 'packages/amaryllis/package.json',
    slug: 'amaryllis-core',
  },
  {
    manifestPath: 'packages/amaryllis-components/package.json',
    slug: 'amaryllis-components',
  },
].map((spec) => ({
  ...spec,
  manifest: JSON.parse(fs.readFileSync(spec.manifestPath, 'utf8')),
}));

function npmPurl(name, version) {
  return `pkg:npm/${encodeURIComponent(name).replace('%2F', '/')}@${version}`;
}

function componentNameFromPurl(component) {
  const purl = component.purl;
  if (typeof purl !== 'string' || !purl.startsWith('pkg:npm/')) return null;
  const withoutPrefix = purl.slice('pkg:npm/'.length);
  const versionSeparator = withoutPrefix.lastIndexOf('@');
  if (versionSeparator <= 0) return null;
  return decodeURIComponent(withoutPrefix.slice(0, versionSeparator));
}

function createPublishedRoot(manifest) {
  const purl = npmPurl(manifest.name, manifest.version);
  return {
    type: 'library',
    name: manifest.name,
    version: manifest.version,
    purl,
    'bom-ref': purl,
  };
}

const publishedByName = new Map(
  packageSpecs.map((spec) => [spec.manifest.name, { ...spec, root: createPublishedRoot(spec.manifest) }])
);

const sourceComponentsByName = new Map();
for (const component of sourceComponents) {
  const name = componentNameFromPurl(component);
  if (!name) continue;
  const matches = sourceComponentsByName.get(name) ?? [];
  matches.push(component);
  sourceComponentsByName.set(name, matches);
}

function resolveExternalComponent(packageName) {
  const matches = sourceComponentsByName.get(packageName) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one resolved component for production dependency ${packageName}, found ${matches.length}`
    );
  }
  return matches[0];
}

function resolveComponent(packageName, scope) {
  const published = publishedByName.get(packageName);
  const component = published?.root ?? resolveExternalComponent(packageName);
  return scope === 'optional' ? { ...component, scope: 'optional' } : component;
}

function collectExternalClosure(startRefs) {
  const visited = new Set();
  const pending = [...startRefs];

  while (pending.length > 0) {
    const ref = pending.pop();
    if (!ref || visited.has(ref)) continue;
    visited.add(ref);

    for (const dependencyRef of sourceDependencyByRef.get(ref) ?? []) {
      pending.push(dependencyRef);
    }
  }

  return visited;
}

function directDependencyEntries(manifest) {
  return [
    ...Object.keys(manifest.dependencies ?? {}).map((name) => ({ name, scope: 'required' })),
    ...Object.keys(manifest.peerDependencies ?? {}).map((name) => ({ name, scope: 'optional' })),
  ];
}

fs.mkdirSync(outputDir, { recursive: true });

for (const packageSpec of packageSpecs) {
  const manifest = packageSpec.manifest;
  const root = publishedByName.get(manifest.name).root;
  const componentByRef = new Map();
  const dependencyByRef = new Map();
  const pendingPublished = [manifest.name];
  const processedPublished = new Set();

  while (pendingPublished.length > 0) {
    const publishedName = pendingPublished.pop();
    if (processedPublished.has(publishedName)) continue;
    processedPublished.add(publishedName);

    const publishedSpec = publishedByName.get(publishedName);
    const publishedRoot = publishedSpec.root;
    if (publishedName !== manifest.name) {
      componentByRef.set(publishedRoot['bom-ref'], publishedRoot);
    }

    const directEntries = directDependencyEntries(publishedSpec.manifest);
    const directRefs = [];
    const requiredExternalRefs = [];

    for (const entry of directEntries) {
      const component = resolveComponent(entry.name, entry.scope);
      const ref = component['bom-ref'];
      if (!ref) {
        throw new Error(`resolved component for ${entry.name} has no bom-ref`);
      }

      directRefs.push(ref);
      if (entry.name !== manifest.name) {
        componentByRef.set(ref, component);
      }

      if (publishedByName.has(entry.name)) {
        pendingPublished.push(entry.name);
      } else if (entry.scope === 'required') {
        requiredExternalRefs.push(ref);
      } else {
        dependencyByRef.set(ref, []);
      }
    }

    dependencyByRef.set(publishedRoot['bom-ref'], directRefs);

    const externalClosure = collectExternalClosure(requiredExternalRefs);
    for (const ref of externalClosure) {
      const component = sourceComponents.find((candidate) => candidate['bom-ref'] === ref);
      if (component) componentByRef.set(ref, component);
      dependencyByRef.set(
        ref,
        (sourceDependencyByRef.get(ref) ?? []).filter((dependencyRef) =>
          externalClosure.has(dependencyRef)
        )
      );
    }
  }

  componentByRef.delete(root['bom-ref']);

  const output = {
    ...source,
    serialNumber: undefined,
    metadata: {
      ...source.metadata,
      component: root,
    },
    components: [...componentByRef.values()].sort((a, b) =>
      String(a['bom-ref']).localeCompare(String(b['bom-ref']))
    ),
    dependencies: [...dependencyByRef.entries()]
      .map(([ref, dependsOn]) => ({ ref, dependsOn: [...new Set(dependsOn)].sort() }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
  };

  const outputPath = path.join(outputDir, `${packageSpec.slug}.cdx.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `Derived ${outputPath}: ${output.components.length + 1} components, ${output.dependencies.length} dependency nodes`
  );
}
