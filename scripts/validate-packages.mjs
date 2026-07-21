import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const packages = [
  {
    directory: repositoryRoot,
    expectedName: '@micrantha/react-native-amaryllis',
    requiredFields: ['main', 'types'],
  },
  {
    directory: resolve(repositoryRoot, 'packages/amaryllis-components'),
    expectedName: '@micrantha/amaryllis-components',
    requiredFields: ['main', 'types', 'bin'],
  },
];

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

async function assertPath(path, description) {
  try {
    await access(path);
  } catch {
    throw new Error(`${description} does not exist: ${path}`);
  }
}

for (const packageConfig of packages) {
  const packageJsonPath = resolve(packageConfig.directory, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

  if (packageJson.name !== packageConfig.expectedName) {
    throw new Error(
      `Expected package name ${packageConfig.expectedName}, received ${packageJson.name}`
    );
  }

  if (!semverPattern.test(packageJson.version)) {
    throw new Error(
      `${packageConfig.expectedName} has an invalid version: ${packageJson.version}`
    );
  }

  for (const field of packageConfig.requiredFields) {
    const value = packageJson[field];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`${packageConfig.expectedName} is missing package.json#${field}`);
    }

    await assertPath(
      resolve(packageConfig.directory, value),
      `${packageConfig.expectedName} ${field} output`
    );
  }

  console.log(`Validated ${packageJson.name}@${packageJson.version}`);
}
