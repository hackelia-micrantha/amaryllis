const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');
const defaultConfig = getDefaultConfig(__dirname);
const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

if (
  defaultConfig.resolver.blockList &&
  !Array.isArray(defaultConfig.resolver.blockList)
) {
  defaultConfig.resolver.blockList = [defaultConfig.resolver.blockList];
}

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const monorepoConfig = withMetroConfig(defaultConfig, {
  root,
  dirname: __dirname,
});

// The library package is consumed from source inside this monorepo, while the
// example app intentionally keeps its own React Native dependency set. Force
// every workspace import through the app's React singletons so Metro cannot
// load a second copy from the monorepo root.
module.exports = {
  ...monorepoConfig,
  resolver: {
    ...monorepoConfig.resolver,
    blockList: [
      ...(monorepoConfig.resolver.blockList || []),
      new RegExp(
        `^${escapeForRegExp(path.resolve(root, 'node_modules/react'))}[\\/\\\\]`
      ),
      new RegExp(
        `^${escapeForRegExp(
          path.resolve(root, 'node_modules/react-native')
        )}[\\/\\\\]`
      ),
    ],
    extraNodeModules: {
      ...monorepoConfig.resolver.extraNodeModules,
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
  },
};
