module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo wires the Reanimated/worklets plugin automatically on SDK 57,
  // so adding it manually here would run the transform twice.
  return {
    presets: ["babel-preset-expo"],
  };
};
