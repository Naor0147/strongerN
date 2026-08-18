// __tests__/mocks/nativeModulesMock.js

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(true),
  getItemAsync: jest.fn().mockResolvedValue('mock-secure-token'),
  deleteItemAsync: jest.fn().mockResolvedValue(true),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn().mockReturnValue({
    execSync: jest.fn(),
    runSync: jest.fn(),
    getFirstSync: jest.fn().mockReturnValue({ value: '{}' }),
  }),
}));

// Mock expo-audio
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(true),
  createAudioPlayer: jest.fn().mockReturnValue({
    play: jest.fn(),
    release: jest.fn(),
    addListener: jest.fn().mockReturnValue({
      remove: jest.fn(),
    }),
  }),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn().mockReturnValue(true),
  useFonts: jest.fn().mockReturnValue([true, null]),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

// Mock AsyncStorage if react-native-web has issues in tests
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    NavigationContainer: ({ children }) => children,
  };
});

// Override standard mockComponent helper in Node's require cache to prevent Object.defineProperty crash on React 19 / RN 0.81
const customMockComponent = (name) => {
  const React = require('react');
  const MockComponent = ({ children, ...props }) => React.createElement(name, props, children);
  MockComponent.displayName = name;
  return MockComponent;
};
jest.doMock('react-native/jest/mockComponent', () => customMockComponent);
try {
  const resolvedPath = require.resolve('react-native/jest/mockComponent');
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: customMockComponent,
  };
} catch (e) {}

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const mockReanimated = {
    View: ({ children, style, ...props }) => React.createElement('View', { style, ...props }, children),
    Text: ({ children, style, ...props }) => React.createElement('Text', { style, ...props }, children),
    ScrollView: ({ children, style, ...props }) => React.createElement('ScrollView', { style, ...props }, children),
    Image: ({ children, style, ...props }) => React.createElement('Image', { style, ...props }, children),
    createAnimatedComponent: (component) => component,
  };
  return {
    __esModule: true,
    default: mockReanimated,
    ...mockReanimated,
    useSharedValue: (val) => ({ value: val }),
    useAnimatedStyle: (fn) => fn(),
    withSpring: (toValue) => toValue,
    withTiming: (toValue) => toValue,
    interpolate: (val, input, output) => {
      // Return a mocked interpolated value
      return output[0];
    },
    runOnJS: (fn) => fn,
    useEvent: (fn) => fn,
  };
});

// Setup react-native-gesture-handler mock
require('react-native-gesture-handler/jestSetup');

// Mock expo-file-system/legacy
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-documents/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('{}'),
  EncodingType: { UTF8: 'utf8' },
}));

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

// Mock expo-application
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
  applicationName: 'StrongerN',
  applicationId: 'com.strongern',
}));




