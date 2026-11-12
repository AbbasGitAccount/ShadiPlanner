const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Share pure web form schemas/types without resolving the web app's React 18 runtime.
config.watchFolders = [path.resolve(__dirname, '../client/src')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { react: path.resolve(__dirname, 'node_modules/react'), 'react-native': path.resolve(__dirname, 'node_modules/react-native') };
module.exports = config;
