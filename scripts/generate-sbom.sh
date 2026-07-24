#!/usr/bin/env bash
set -euo pipefail

output_file="${1:-artifacts/sbom.cdx.json}"
output_dir="$(dirname "$output_file")"

mkdir -p "$output_dir"

# v2 supports the Yarn 3 toolchain pinned by this repository. Keep the
# generator version explicit so SBOM changes are reviewable and reproducible.
yarn dlx -q @cyclonedx/yarn-plugin-cyclonedx@2.1.0 \
  --output-format JSON \
  --spec-version 1.6 \
  --output-reproducible \
  --mc-type library \
  --output-file "$output_file"

node - "$output_file" <<'NODE'
const fs = require('node:fs');

const path = process.argv[2];
const sbom = JSON.parse(fs.readFileSync(path, 'utf8'));

if (sbom.bomFormat !== 'CycloneDX') {
  throw new Error(`unexpected SBOM format: ${sbom.bomFormat ?? '<missing>'}`);
}

if (!Array.isArray(sbom.components) || sbom.components.length === 0) {
  throw new Error('SBOM contains no components');
}

console.log(
  `Generated ${path}: CycloneDX ${sbom.specVersion}, ${sbom.components.length} components`
);
NODE
