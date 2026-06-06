module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: [],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: [
    "./src/__tests__/mocks/nativeModulesMock.js"
  ],
  moduleNameMapper: {
    '\\.(wav|mp3|png|jpg|jpeg|gif)$': '<rootDir>/src/__tests__/mocks/fileMock.js',
  },
  testMatch: [
    "**/*.test.ts",
    "**/*.test.tsx"
  ]
};
