#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [inputPath = 'artifacts/sbom.cdx.json', outputDir = 'artifacts/packages'] =
  process.argv.slice(2);

const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const components = Array.isArray(source.components) ? source.components : [];
const dependencies = Array.isArray(source.dependencies) ? source.dependencies : [];
const dependencyByRef = new Map(
  dependencies.map((dependency) => [dependency.ref, dependency.dependsOn ?? []])
);

const packages = [
  {
    name: '@micrantha/react-native-amaryllis',
    slug: 'react-native-amaryllis',
  },
  {
    name: '@micrantha/amaryllis',
    slug: 'amaryllis-core',
  },
  {
    name: '@micrantha/amaryllis-components',
    slug: 'amaryllis-components',
  },
];

function npmPurlPrefix(name) {
  return `pkg:npm/${encodeURIComponent(name).replace('%2F', '/')}@`;
}

function findRoot(packageName) {
  const prefix = npmPurlPrefix(packageName);
  const matches = components.filter((component) => component.purl?.startsWith(prefix));

  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one SBOM component for ${packageName}, found ${matches.length}`
    );
  }

  return matches[0];
}

function collectClosure(rootRef) {
  const visited = new Set();
  const pending = [rootRef];

  while (pending.length > 0) {
    const ref = pending.pop();
    if (!ref || visited.has(ref)) continue;
    visited.add(ref);

    for (const dependency of dependencyByRef.get(ref) ?? []) {
      pending.push(dependency);
    }
  }

  return visited;
}

fs.mkdirSync(outputDir, { recursive: true });

for (const packageSpec of packages) {
  const root = findRoot(packageSpec.name);
  const rootRef = root['bom-ref'];
  if (!rootRef) {
    throw new Error(`SBOM component for ${packageSpec.name} has no bom-ref`);
  }

  const closure = collectClosure(rootRef);
  const packageComponents = components.filter(
    (component) => component['bom-ref'] && closure.has(component['bom-ref'])
  );
  const packageDependencies = dependencies
    .filter((dependency) => closure.has(dependency.ref))
    .map((dependency) => ({
      ...dependency,
      dependsOn: (dependency.dependsOn ?? []).filter((ref) => closure.has(ref)),
    }));

  const output = {
    ...source,
    serialNumber: undefined,
    metadata: {
      ...source.metadata,
      component: root,
    },
    components: packageComponents.filter(
      (component) => component['bom-ref'] !== rootRef
    ),
    dependencies: packageDependencies,
  };

  const outputPath = path.join(outputDir, `${packageSpec.slug}.cdx.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `Derived ${outputPath}: ${packageComponents.length} components, ${packageDependencies.length} dependency nodes`
  );
}
