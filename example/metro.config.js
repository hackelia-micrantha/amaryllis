const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');
const defaultConfig = getDefaultConfig(__dirname);

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
module.exports = withMetroConfig(defaultConfig, {
  root,
  dirname: __dirname,
});
