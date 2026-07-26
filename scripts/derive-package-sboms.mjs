#!/usr/bin/env node

import { derivePackageSbomsFromFiles } from './package-sbom-lib.mjs';

const [inputPath = 'artifacts/sbom.cdx.json', outputDir = 'artifacts/packages'] =
  process.argv.slice(2);

const packageSpecs = [
  { manifestPath: 'package.json', slug: 'react-native-amaryllis' },
  { manifestPath: 'packages/amaryllis/package.json', slug: 'amaryllis-core' },
  {
    manifestPath: 'packages/amaryllis-components/package.json',
    slug: 'amaryllis-components',
  },
];

derivePackageSbomsFromFiles({
  inputPath,
  outputDir,
  packageSpecs,
  lockPath: 'yarn.lock',
});
