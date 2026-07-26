const DOCUMENTATION_PATTERNS = [/^docs\//, /^[^/]+\.md$/];
const COMPONENTS_PATTERN = /^packages\/amaryllis-components\//;
const ROOT_SOURCE_PATTERNS = [/^src\//, /^__tests__\//, /^tests?\//];
const NATIVE_PATTERNS = [/^example\//, /^android\//, /^ios\//];
const SHARED_PATTERNS = [
  /^\.github\//,
  /^scripts\//,
  /^package\.json$/,
  /^yarn\.lock$/,
  /^turbo\.json$/,
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^babel\.config\.[^/]+$/,
  /^jest\.config\.[^/]+$/,
  /^metro\.config\.[^/]+$/,
  /^eslint\.config\.[^/]+$/,
  /^\.eslintrc(?:\.[^/]+)?$/,
  /^\.prettierrc(?:\.[^/]+)?$/,
  /^prettier\.config\.[^/]+$/,
  /^react-native\.config\.[^/]+$/,
  /^rollup\.config\.[^/]+$/,
  /^vite\.config\.[^/]+$/,
  /^webpack\.config\.[^/]+$/,
  /^Gemfile(?:\.lock)?$/,
];

function matchesAny(path, patterns) {
  return patterns.some(pattern => pattern.test(path));
}

function fullClassification(reason) {
  return {
    runRoot: true,
    runComponents: true,
    runNative: true,
    reason,
  };
}

export function classifyCiChanges(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return fullClassification('no changed paths were available; running all CI validation');
  }

  let runRoot = false;
  let runComponents = false;
  let runNative = false;

  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0) {
      return fullClassification('invalid changed path data was detected; running all CI validation');
    }

    if (matchesAny(path, DOCUMENTATION_PATTERNS)) continue;

    if (COMPONENTS_PATTERN.test(path)) {
      runComponents = true;
      continue;
    }

    if (matchesAny(path, ROOT_SOURCE_PATTERNS)) {
      runRoot = true;
      runNative = true;
      continue;
    }

    if (matchesAny(path, NATIVE_PATTERNS)) {
      runRoot = true;
      runNative = true;
      continue;
    }

    if (matchesAny(path, SHARED_PATTERNS)) {
      return fullClassification('shared CI, dependency, workspace, or build configuration changed');
    }

    return fullClassification('an unknown path changed; running all CI validation');
  }

  if (!runRoot && !runComponents && !runNative) {
    return {
      runRoot: false,
      runComponents: false,
      runNative: false,
      reason: 'all changed paths are explicitly classified as documentation-only',
    };
  }

  const affected = [
    runRoot && 'root',
    runComponents && 'components',
    runNative && 'native',
  ].filter(Boolean);

  return {
    runRoot,
    runComponents,
    runNative,
    reason: `affected CI dimensions: ${affected.join(', ')}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = classifyCiChanges(process.argv.slice(2));
  process.stdout.write(`run_root=${result.runRoot}\n`);
  process.stdout.write(`run_components=${result.runComponents}\n`);
  process.stdout.write(`run_native=${result.runNative}\n`);
  process.stdout.write(`reason=${result.reason}\n`);
}
