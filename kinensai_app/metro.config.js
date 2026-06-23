const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// CSVファイルをアセット（画像などと同じ扱い）として読み込めるようにする
config.resolver.assetExts.push('csv');

module.exports = config;