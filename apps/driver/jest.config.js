module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // @haulpilot/shared is consumed as TypeScript source, so it must be transformed too.
  transformIgnorePatterns: [
    'node_modules/(?!(@haulpilot|(jest-)?react-native|@react-native(-community)?|react-native-.*)/)',
  ],
};
