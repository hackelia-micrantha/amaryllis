const SAFE_NON_NATIVE_PATTERNS = [
  /^docs\//,
  /^packages\/amaryllis-components\//,
  /^[^/]+\.md$/,
];

export function classifyCiChanges(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return {
      runNative: true,
      reason: 'no changed paths were available; running the full native matrix',
    };
  }

  const hasUnsafePath = paths.some(
    path => !SAFE_NON_NATIVE_PATTERNS.some(pattern => pattern.test(path))
  );

  if (hasUnsafePath) {
    return {
      runNative: true,
      reason: 'native-relevant or unknown paths changed; running the full native matrix',
    };
  }

  return {
    runNative: false,
    reason: 'all changed paths are explicitly classified as non-native',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = classifyCiChanges(process.argv.slice(2));
  process.stdout.write(`run_native=${result.runNative}\n`);
  process.stdout.write(`reason=${result.reason}\n`);
}
