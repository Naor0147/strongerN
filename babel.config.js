module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      '@ohah/react-native-mcp-server/babel-preset',
    ],
  };
};
