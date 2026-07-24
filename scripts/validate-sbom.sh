#!/usr/bin/env bash
set -euo pipefail

sbom_file="${1:-artifacts/sbom.cdx.json}"

node - "$sbom_file" <<'NODE'
const fs = require('node:fs');

const path = process.argv[2];
const sbom = JSON.parse(fs.readFileSync(path, 'utf8'));

if (sbom.bomFormat !== 'CycloneDX') {
  throw new Error(`unexpected SBOM format: ${sbom.bomFormat ?? '<missing>'}`);
}

if (sbom.specVersion !== '1.6') {
  throw new Error(`unexpected CycloneDX version: ${sbom.specVersion ?? '<missing>'}`);
}

if (!Array.isArray(sbom.components) || sbom.components.length === 0) {
  throw new Error('SBOM contains no components');
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

const purls = sbom.components
  .map((component) => component.purl)
  .filter(Boolean);

for (const expected of [
  'pkg:npm/%40micrantha/react-native-amaryllis@',
  'pkg:npm/react-native-amaryllis-example@',
]) {
  if (!purls.some((purl) => purl.startsWith(expected))) {
    throw new Error(`SBOM is missing expected component: ${expected}`);
  }
}

console.log(
  `Validated ${path}: CycloneDX ${sbom.specVersion}, ${sbom.components.length} components, ${sbom.dependencies.length} dependency nodes`
);
NODE
