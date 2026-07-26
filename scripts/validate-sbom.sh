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

if (expectedPackage) {
  if (root?.name !== expectedPackage) {
    throw new Error(
      `SBOM root package mismatch: expected ${expectedPackage}, found ${root?.name ?? '<missing>'}`
    );
  }

  const expectedPurl = `pkg:npm/${encodeURIComponent(expectedPackage).replace('%2F', '/')}@`;
  if (!root.purl?.startsWith(expectedPurl)) {
    throw new Error(`SBOM root purl mismatch: expected ${expectedPurl}, found ${root.purl ?? '<missing>'}`);
  }

  const rootRef = root['bom-ref'];
  const rootDependency = sbom.dependencies.find((dependency) => dependency.ref === rootRef);
  if (!rootRef || !rootDependency) {
    throw new Error('package SBOM dependency graph does not contain its root component');
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
