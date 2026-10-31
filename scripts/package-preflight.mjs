import { execFile } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  assertInternalDependencyCompatibility,
  assertNoWorkspaceProtocols,
  assertRuntimeImportsDeclared,
  materializePublishedManifest,
} from './package-release-lib.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const packageConfigs = [
  {
    key: 'core',
    directory: resolve(repositoryRoot, 'packages/amaryllis'),
    expectedName: '@micrantha/amaryllis',
    requiredFields: ['main', 'types'],
  },
  {
    key: 'root',
    directory: repositoryRoot,
    expectedName: '@micrantha/react-native-amaryllis',
    requiredFields: ['main', 'types'],
  },
  {
    key: 'components',
    directory: resolve(repositoryRoot, 'packages/amaryllis-components'),
    expectedName: '@micrantha/amaryllis-components',
    requiredFields: ['main', 'types', 'bin'],
  },
];

const publishOrder = [
  '@micrantha/amaryllis',
  '@micrantha/react-native-amaryllis',
  '@micrantha/amaryllis-components',
];

function parseArgs(argv) {
  const options = {
    outputDirectory: resolve(repositoryRoot, 'release-artifacts'),
    versionSuffix: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output-dir') {
      options.outputDirectory = resolve(repositoryRoot, argv[++index]);
    } else if (argument === '--version-suffix') {
      options.versionSuffix = argv[++index] ?? '';
    } else {
      throw new Error(`Unknown package preflight argument: ${argument}`);
    }
  }

  if (
    options.versionSuffix &&
    !/^[0-9A-Za-z][0-9A-Za-z.-]*$/.test(options.versionSuffix)
  ) {
    throw new Error(`Invalid version suffix: ${options.versionSuffix}`);
  }
  return options;
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.stdout;
}

async function assertPath(path, description) {
  try {
    await access(path);
  } catch {
    throw new Error(`${description} does not exist: ${path}`);
  }
}

function assertInside(base, candidate) {
  const path = relative(base, candidate);
  if (path === '..' || path.startsWith(`..${sep}`) || path.startsWith(sep)) {
    throw new Error(`Package file escaped package directory: ${candidate}`);
  }
}

function getFieldPaths(manifest, field) {
  const value = manifest[field];
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }
  if (field === 'bin' && value && typeof value === 'object') {
    const values = Object.values(value);
    if (
      values.length > 0 &&
      values.every((entry) => typeof entry === 'string' && entry.length > 0)
    ) {
      return values;
    }
  }
  throw new Error(`${manifest.name} is missing package.json#${field}`);
}

async function enumeratePackedFiles(directory) {
  const stdout = await run(
    'npm',
    ['pack', '--json', '--dry-run', '--ignore-scripts'],
    { cwd: directory }
  );
  const result = JSON.parse(stdout);
  if (!Array.isArray(result) || result.length !== 1 || !Array.isArray(result[0].files)) {
    throw new Error(`Unexpected npm pack --dry-run output for ${directory}`);
  }
  return result[0].files.map((entry) => entry.path);
}

async function stagePackage(config, manifest, effectiveVersions, stagingRoot) {
  const stageDirectory = resolve(stagingRoot, config.key);
  await mkdir(stageDirectory, { recursive: true });
  const packedFiles = await enumeratePackedFiles(config.directory);

  for (const file of packedFiles) {
    if (file === 'package.json') continue;
    const source = resolve(config.directory, file);
    const destination = resolve(stageDirectory, file);
    assertInside(config.directory, source);
    assertInside(stageDirectory, destination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }

  const publishedManifest = materializePublishedManifest(
    manifest,
    effectiveVersions
  );
  await writeFile(
    resolve(stageDirectory, 'package.json'),
    `${JSON.stringify(publishedManifest, null, 2)}\n`
  );

  for (const field of config.requiredFields) {
    for (const fieldPath of getFieldPaths(publishedManifest, field)) {
      await assertPath(
        resolve(stageDirectory, fieldPath),
        `${publishedManifest.name} ${field} output`
      );
    }
  }

  const runtimeSources = [];
  const queue = [stageDirectory];
  while (queue.length > 0) {
    const directory = queue.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        queue.push(path);
      } else if (/\.(?:c|m)?js$/.test(entry.name)) {
        runtimeSources.push(await readFile(path, 'utf8'));
      }
    }
  }
  assertRuntimeImportsDeclared(publishedManifest, runtimeSources);

  return { stageDirectory, publishedManifest };
}

async function packStagedPackage(packageState, outputDirectory) {
  const stdout = await run(
    'npm',
    [
      'pack',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      outputDirectory,
    ],
    { cwd: packageState.stageDirectory }
  );
  const result = JSON.parse(stdout);
  if (!Array.isArray(result) || result.length !== 1 || !result[0].filename) {
    throw new Error(
      `Unexpected npm pack output for ${packageState.publishedManifest.name}`
    );
  }
  return result[0].filename;
}

async function validateCleanConsumer(packageStates, outputDirectory) {
  const consumerDirectory = await mkdtemp(
    join(tmpdir(), 'amaryllis-clean-consumer-')
  );
  try {
    await writeFile(
      resolve(consumerDirectory, 'package.json'),
      `${JSON.stringify(
        { name: 'amaryllis-clean-consumer', private: true, version: '1.0.0' },
        null,
        2
      )}\n`
    );

    const byName = Object.fromEntries(
      packageStates.map((entry) => [entry.publishedManifest.name, entry])
    );
    const commonInstallArgs = [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--legacy-peer-deps',
    ];

    const core = byName['@micrantha/amaryllis'];
    await run(
      'npm',
      [...commonInstallArgs, resolve(outputDirectory, core.filename)],
      { cwd: consumerDirectory }
    );

    const remaining = publishOrder
      .slice(1)
      .map((name) => resolve(outputDirectory, byName[name].filename));
    await run('npm', [...commonInstallArgs, ...remaining], {
      cwd: consumerDirectory,
    });

    const smokeScript = `
const fs = require('node:fs');
const path = require('node:path');

const packagePath = (name) => path.join(
  process.cwd(),
  'node_modules',
  ...name.split('/'),
  'package.json'
);
const manifest = (name) => JSON.parse(fs.readFileSync(packagePath(name), 'utf8'));
const names = ${JSON.stringify(publishOrder)};
const manifests = Object.fromEntries(names.map((name) => [name, manifest(name)]));

for (const pkg of Object.values(manifests)) {
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
    for (const specifier of Object.values(pkg[section] || {})) {
      if (typeof specifier === 'string' && specifier.startsWith('workspace:')) {
        throw new Error(pkg.name + ' contains unresolved workspace protocol dependency');
      }
    }
  }
}

const core = require('@micrantha/amaryllis');
if (!core || typeof core !== 'object') throw new Error('Core root import failed');
const context = require('@micrantha/amaryllis/context');
if (typeof context.createContextEngine !== 'function') {
  throw new Error('Core context export is unavailable');
}
const store = {
  put: async () => {},
  query: async () => [],
  delete: async () => {},
  compact: async () => {},
  stats: async () => ({ itemCount: 0 }),
};
const engine = context.createContextEngine({ store });
engine.search({ text: 'package-smoke', limit: 1 }).then((items) => {
  if (!Array.isArray(items)) throw new Error('Context Engine smoke failed');
}).then(() => {
  require.resolve('@micrantha/react-native-amaryllis');
  require.resolve('@micrantha/react-native-amaryllis/context');
  require.resolve('@micrantha/amaryllis-components');

  const root = manifests['@micrantha/react-native-amaryllis'];
  const installedCore = manifests['@micrantha/amaryllis'];
  if (root.dependencies?.['@micrantha/amaryllis'] !== installedCore.version) {
    throw new Error('Root/core packed version relationship is inconsistent');
  }

  const components = manifests['@micrantha/amaryllis-components'];
  const bins = typeof components.bin === 'string' ? [components.bin] : Object.values(components.bin || {});
  if (!bins.length || bins.some((entry) => !fs.existsSync(path.join(path.dirname(packagePath(components.name)), entry)))) {
    throw new Error('Components bin output is unavailable');
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;
    await writeFile(resolve(consumerDirectory, 'smoke.cjs'), smokeScript);
    await run('node', ['smoke.cjs'], { cwd: consumerDirectory });
  } finally {
    await rm(consumerDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await rm(options.outputDirectory, { recursive: true, force: true });
  await mkdir(options.outputDirectory, { recursive: true });

  const manifests = {};
  for (const config of packageConfigs) {
    const manifest = JSON.parse(
      await readFile(resolve(config.directory, 'package.json'), 'utf8')
    );
    if (manifest.name !== config.expectedName) {
      throw new Error(
        `Expected package ${config.expectedName}, received ${manifest.name}`
      );
    }
    manifests[manifest.name] = manifest;
  }

  const effectiveVersions = Object.fromEntries(
    Object.values(manifests).map((manifest) => [
      manifest.name,
      options.versionSuffix
        ? `${manifest.version}-${options.versionSuffix}`
        : manifest.version,
    ])
  );

  const stagingRoot = await mkdtemp(join(tmpdir(), 'amaryllis-package-stage-'));
  try {
    const packageStates = [];
    for (const config of packageConfigs) {
      packageStates.push(
        await stagePackage(
          config,
          manifests[config.expectedName],
          effectiveVersions,
          stagingRoot
        )
      );
    }

    const stagedByName = Object.fromEntries(
      packageStates.map((entry) => [entry.publishedManifest.name, entry.publishedManifest])
    );
    for (const manifest of Object.values(stagedByName)) {
      assertNoWorkspaceProtocols(manifest);
    }
    assertInternalDependencyCompatibility(stagedByName);

    for (const state of packageStates) {
      state.filename = await packStagedPackage(state, options.outputDirectory);
      console.log(
        `Packed ${state.publishedManifest.name}@${state.publishedManifest.version} -> ${state.filename}`
      );
    }

    await validateCleanConsumer(packageStates, options.outputDirectory);

    const artifactManifest = {
      schemaVersion: 1,
      publishOrder,
      packages: packageStates.map((state) => ({
        name: state.publishedManifest.name,
        version: state.publishedManifest.version,
        filename: state.filename,
      })),
    };
    await writeFile(
      resolve(options.outputDirectory, 'package-release.json'),
      `${JSON.stringify(artifactManifest, null, 2)}\n`
    );
    console.log('Clean consumer package preflight passed.');
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

await main();
