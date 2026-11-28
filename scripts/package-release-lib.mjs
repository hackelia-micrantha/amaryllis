import { builtinModules } from 'node:module';

export const publishOrder = Object.freeze([
  '@micrantha/amaryllis',
  '@micrantha/react-native-amaryllis',
  '@micrantha/amaryllis-components',
]);

export function validateReleaseArtifactManifest(manifest) {
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.publishOrder) ||
    !Array.isArray(manifest.packages) ||
    manifest.publishOrder.length !== publishOrder.length ||
    manifest.packages.length !== publishOrder.length ||
    manifest.publishOrder.some((name, i) => name !== publishOrder[i])
  ) {
    throw new Error('Unexpected release artifact manifest');
  }

  const packagesByName = Object.create(null);
  for (const entry of manifest.packages) {
    if (
      !entry ||
      !publishOrder.includes(entry.name) ||
      Object.hasOwn(packagesByName, entry.name) ||
      typeof entry.version !== 'string' ||
      !semverPattern.test(entry.version) ||
      typeof entry.filename !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*\.tgz$/.test(entry.filename)
    ) {
      throw new Error('Invalid package release artifact entry');
    }
    packagesByName[entry.name] = entry;
  }

  if (publishOrder.some((name) => !packagesByName[name])) {
    throw new Error('Release artifact manifest is missing an expected package');
  }
  return packagesByName;
}

export function assertPackedArtifactIdentity(entry, packedManifest) {
  if (
    packedManifest?.name !== entry.name ||
    packedManifest?.version !== entry.version
  ) {
    throw new Error(`Packed release artifact identity mismatch: ${entry.name}@${entry.version}`);
  }
}

const runtimeDependencySections = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];

const allDependencySections = [
  ...runtimeDependencySections,
  'devDependencies',
];

const builtinSpecifiers = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const semverPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(version) {
  const match = semverPattern.exec(version);
  if (!match) {
    throw new Error(`Unsupported semantic version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function compareVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) {
      return left[key] - right[key];
    }
  }
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  return left.prerelease.localeCompare(right.prerelease);
}

export function satisfiesSimpleRange(version, range) {
  if (range === '*' || range === 'latest') return true;
  if (range === version) return true;

  const actual = parseVersion(version);
  const operator = range[0];
  if (operator !== '^' && operator !== '~') {
    return false;
  }

  const baseVersion = range.slice(1);
  const base = parseVersion(baseVersion);
  if (actual.prerelease && !base.prerelease) {
    return false;
  }
  if (compareVersions(actual, base) < 0) {
    return false;
  }

  let upper;
  if (operator === '~') {
    upper = { major: base.major, minor: base.minor + 1, patch: 0, prerelease: null };
  } else if (base.major > 0) {
    upper = { major: base.major + 1, minor: 0, patch: 0, prerelease: null };
  } else if (base.minor > 0) {
    upper = { major: 0, minor: base.minor + 1, patch: 0, prerelease: null };
  } else {
    upper = { major: 0, minor: 0, patch: base.patch + 1, prerelease: null };
  }

  return compareVersions(actual, upper) < 0;
}

export function materializeWorkspaceSpecifier(specifier, targetVersion) {
  if (!specifier.startsWith('workspace:')) {
    return specifier;
  }

  const selector = specifier.slice('workspace:'.length);
  if (selector === '' || selector === '*') return targetVersion;
  if (selector === '^') return `^${targetVersion}`;
  if (selector === '~') return `~${targetVersion}`;

  if (!satisfiesSimpleRange(targetVersion, selector)) {
    throw new Error(
      `Workspace selector ${specifier} does not accept target version ${targetVersion}`
    );
  }
  return selector;
}

export function materializePublishedManifest(manifest, effectiveVersions) {
  const result = structuredClone(manifest);
  const ownVersion = effectiveVersions[result.name];
  if (!ownVersion) {
    throw new Error(`No effective release version was provided for ${result.name}`);
  }
  result.version = ownVersion;
  delete result.workspaces;

  for (const section of allDependencySections) {
    const dependencies = result[section];
    if (!dependencies) continue;
    for (const [dependencyName, specifier] of Object.entries(dependencies)) {
      if (typeof specifier !== 'string' || !specifier.startsWith('workspace:')) {
        continue;
      }
      const targetVersion = effectiveVersions[dependencyName];
      if (!targetVersion) {
        throw new Error(
          `${result.name} references unpublished workspace dependency ${dependencyName}`
        );
      }
      dependencies[dependencyName] = materializeWorkspaceSpecifier(
        specifier,
        targetVersion
      );
    }
  }

  assertNoWorkspaceProtocols(result);
  return result;
}

export function assertNoWorkspaceProtocols(manifest) {
  for (const section of allDependencySections) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (typeof specifier === 'string' && specifier.startsWith('workspace:')) {
        throw new Error(
          `${manifest.name} has unresolved ${section} entry ${name}: ${specifier}`
        );
      }
    }
  }
}

export function assertInternalDependencyCompatibility(manifestsByName) {
  for (const manifest of Object.values(manifestsByName)) {
    for (const section of runtimeDependencySections) {
      for (const [dependencyName, specifier] of Object.entries(
        manifest[section] ?? {}
      )) {
        const target = manifestsByName[dependencyName];
        if (!target) continue;
        if (!satisfiesSimpleRange(target.version, specifier)) {
          throw new Error(
            `${manifest.name}@${manifest.version} requires ${dependencyName}@${specifier}, ` +
              `but the release contains ${target.version}`
          );
        }
      }
    }
  }
}

export function packageNameFromSpecifier(specifier) {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    builtinSpecifiers.has(specifier)
  ) {
    return null;
  }
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return name ? `${scope}/${name}` : specifier;
  }
  return specifier.split('/')[0];
}

export function extractRuntimeSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }
  return specifiers;
}

export function assertRuntimeImportsDeclared(manifest, sources) {
  const allowed = new Set([
    manifest.name,
    ...runtimeDependencySections.flatMap((section) =>
      Object.keys(manifest[section] ?? {})
    ),
  ]);
  const missing = new Set();

  for (const source of sources) {
    for (const specifier of extractRuntimeSpecifiers(source)) {
      const packageName = packageNameFromSpecifier(specifier);
      if (packageName && !allowed.has(packageName)) {
        missing.add(packageName);
      }
    }
  }

  if (missing.size > 0) {
    throw new Error(
      `${manifest.name} built output imports undeclared runtime packages: ${[
        ...missing,
      ].sort().join(', ')}`
    );
  }
}
