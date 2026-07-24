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
if (!root || typeof root.name !== 'string' || root.name.length === 0) {
  throw new Error('SBOM contains no root metadata component');
}

if (!['application', 'library'].includes(root.type)) {
  throw new Error(`unexpected root component type: ${root.type ?? '<missing>'}`);
}

if (!Array.isArray(sbom.dependencies) || sbom.dependencies.length === 0) {
  throw new Error('SBOM contains no dependency graph');
}

const componentNames = new Set(sbom.components.map((component) => component.name));
for (const expected of ['react', 'react-native']) {
  if (!componentNames.has(expected)) {
    throw new Error(`SBOM is missing expected dependency: ${expected}`);
  }
}

console.log(
  `Validated ${path}: CycloneDX ${sbom.specVersion}, ${sbom.components.length} components, ${sbom.dependencies.length} dependency nodes`
);
NODE
