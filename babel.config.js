module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod v4 ships ES modules that use `export * as ns from "..."`. React Native's
  // default babel preset does not transform that syntax, so Metro crashes during
  // bundling with "Export namespace should be first transformed". The plugin
  // below normalizes those re-exports into something Hermes/Metro can consume.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
