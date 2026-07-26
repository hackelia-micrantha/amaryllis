#!/usr/bin/env bash
set -euo pipefail

sbom_file="${1:-artifacts/sbom.cdx.json}"
expected_package="${2:-}"

node - "$sbom_file" "$expected_package" <<'NODE'
const fs = require('node:fs');

const path = process.argv[2];
const expectedPackage = process.argv[3];
const sbom = JSON.parse(fs.readFileSync(path, 'utf8'));

if (sbom.bomFormat !== 'CycloneDX') {
  throw new Error(`unexpected SBOM format: ${sbom.bomFormat ?? '<missing>'}`);
}

if (sbom.specVersion !== '1.6') {
  throw new Error(`unexpected CycloneDX version: ${sbom.specVersion ?? '<missing>'}`);
}

if (!Array.isArray(sbom.components)) {
  throw new Error('SBOM components must be an array');
}

const root = sbom.metadata?.component;
if (root) {
  if (typeof root.name !== 'string' || root.name.length === 0) {
    throw new Error('SBOM root metadata component has no name');
  }

  if (typeof root.type !== 'string' || root.type.length === 0) {
    throw new Error('SBOM root metadata component has no type');
  }
}

if (!Array.isArray(sbom.dependencies) || sbom.dependencies.length === 0) {
  throw new Error('SBOM contains no dependency graph');
}

const allComponents = root ? [root, ...sbom.components] : sbom.components;
const purls = allComponents.map((component) => component.purl).filter(Boolean);
const componentByName = new Map(allComponents.map((component) => [component.name, component]));
const dependencyByRef = new Map(sbom.dependencies.map((dependency) => [dependency.ref, dependency]));

const packageManifests = {
  '@micrantha/react-native-amaryllis': 'package.json',
  '@micrantha/amaryllis': 'packages/amaryllis/package.json',
  '@micrantha/amaryllis-components': 'packages/amaryllis-components/package.json',
};

function npmPurl(name, version) {
  return `pkg:npm/${encodeURIComponent(name).replace(/%2F/g, '/')}@${encodeURIComponent(version)}`;
}

function hasPackage(packageName) {
  const prefix = `pkg:npm/${encodeURIComponent(packageName).replace(/%2F/g, '/')}@`;
  return purls.some((purl) => purl.startsWith(prefix));
}

if (expectedPackage) {
  const manifestPath = packageManifests[expectedPackage];
  if (!manifestPath) {
    throw new Error(`no manifest configured for expected package ${expectedPackage}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expectedPurl = npmPurl(manifest.name, manifest.version);

  if (root?.name !== manifest.name) {
    throw new Error(
      `SBOM root package mismatch: expected ${manifest.name}, found ${root?.name ?? '<missing>'}`
    );
  }
  if (root?.version !== manifest.version) {
    throw new Error(
      `SBOM root version mismatch: expected ${manifest.version}, found ${root?.version ?? '<missing>'}`
    );
  }
  if (root?.purl !== expectedPurl || root?.['bom-ref'] !== expectedPurl) {
    throw new Error(
      `SBOM root identity mismatch: expected ${expectedPurl}, found purl=${root?.purl ?? '<missing>'} bom-ref=${root?.['bom-ref'] ?? '<missing>'}`
    );
  }

  const rootDependency = dependencyByRef.get(root['bom-ref']);
  if (!rootDependency) {
    throw new Error('package SBOM dependency graph does not contain its root component');
  }

  const productionNames = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  for (const dependencyName of productionNames) {
    if (!hasPackage(dependencyName)) {
      throw new Error(`package SBOM is missing declared production dependency ${dependencyName}`);
    }
  }

  for (const devDependencyName of Object.keys(manifest.devDependencies ?? {})) {
    if (!productionNames.has(devDependencyName) && hasPackage(devDependencyName)) {
      throw new Error(`package SBOM contains development-only dependency ${devDependencyName}`);
    }
  }

  if (expectedPackage === '@micrantha/amaryllis-components') {
    const ajv = componentByName.get('ajv');
    const ajvNode = ajv && dependencyByRef.get(ajv['bom-ref']);
    if (!ajvNode || !Array.isArray(ajvNode.dependsOn) || ajvNode.dependsOn.length === 0) {
      throw new Error('components SBOM is missing ajv transitive production dependencies');
    }
    for (const ref of ajvNode.dependsOn) {
      if (!allComponents.some((component) => component['bom-ref'] === ref)) {
        throw new Error(`components SBOM dependency graph references missing component ${ref}`);
      }
    }
  }
} else {
  if (sbom.components.length === 0) {
    throw new Error('repository SBOM contains no components');
  }

  for (const expected of [
    'pkg:npm/%40micrantha/react-native-amaryllis@',
    'pkg:npm/react-native-amaryllis-example@',
  ]) {
    if (!purls.some((purl) => purl.startsWith(expected))) {
      throw new Error(`SBOM is missing expected component: ${expected}`);
    }
  }
}

console.log(
  `Validated ${path}: CycloneDX ${sbom.specVersion}, ${allComponents.length} components, ${sbom.dependencies.length} dependency nodes`
);
NODE
