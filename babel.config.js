module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
    ],
    // Override css-interop's babel to exclude worklets plugin
    overrides: [
      {
        exclude: /node_modules/,
      },
    ],
  };
};
