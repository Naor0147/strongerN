// __tests__/mocks/nativeModulesMock.js

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(true),
  getItemAsync: jest.fn().mockResolvedValue('mock-secure-token'),
  deleteItemAsync: jest.fn().mockResolvedValue(true),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => {
  const store = new Map();
  return {
    openDatabaseSync: jest.fn().mockReturnValue({
      execSync: jest.fn(),
      runSync: jest.fn((query, params) => {
        if (params && params[0] && params[1] !== undefined) store.set(params[0], params[1]);
      }),
      getFirstSync: jest.fn((query, params) => {
        const key = params ? params[0] : null;
        return key && store.has(key) ? { value: store.get(key) } : null;
      }),
    }),
    openDatabaseAsync: jest.fn().mockResolvedValue({
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn((query, params) => {
        if (params && params[0] && params[1] !== undefined) store.set(params[0], params[1]);
        return Promise.resolve(undefined);
      }),
      getFirstAsync: jest.fn((query, params) => {
        const key = params ? params[0] : null;
        return Promise.resolve(key && store.has(key) ? { value: store.get(key) } : null);
      }),
      getAllAsync: jest.fn().mockResolvedValue([]),
    }),
  };
});

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

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock @expo/vector-icons
const MockIonicons = 'Ionicons';
jest.mock('@expo/vector-icons', () => ({
  Ionicons: MockIonicons,
}));
jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: MockIonicons,
  font: { ionicons: 'Ionicons.ttf' },
  glyphMap: {},
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }),
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'opened' }),
  dismissBrowser: jest.fn().mockResolvedValue({ type: 'dismiss' }),
  dismissAuthSession: jest.fn(),
  getCustomTabsSupportingBrowsersAsync: jest.fn().mockResolvedValue({
    browserPackages: ['com.android.chrome'],
    servicePackages: ['com.android.chrome'],
    defaultBrowserPackage: 'com.android.chrome',
    preferredBrowserPackage: 'com.android.chrome',
  }),
  warmUpAsync: jest.fn().mockResolvedValue({ servicePackage: 'com.android.chrome' }),
  coolDownAsync: jest.fn().mockResolvedValue({}),
  mayInitWithUrlAsync: jest.fn().mockResolvedValue({}),
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
  const withSpring = jest.fn((toValue, config) => toValue);
  const withTiming = jest.fn((toValue, config) => toValue);
  const withDelay = jest.fn((_delay, anim) => anim);
  const withRepeat = jest.fn((anim) => anim);
  const withSequence = jest.fn((...anims) => anims[0]);
  const cancelAnimation = jest.fn();

  return {
    __esModule: true,
    default: mockReanimated,
    ...mockReanimated,
    useSharedValue: (val) => ({ value: val }),
    useAnimatedStyle: (fn) => fn(),
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    cancelAnimation,
    Easing: {
      linear: (t) => t,
      ease: (t) => t,
      quad: (t) => t,
      cubic: (t) => t,
      sin: (t) => t,
      in: (fn) => fn,
      out: (fn) => fn,
      inOut: (fn) => fn,
    },
    Extrapolation: {
      EXTEND: 'extend',
      CLAMP: 'clamp',
      IDENTITY: 'identity',
    },
    interpolate: (val, input, output, type) => {
      // Return a mocked interpolated value
      return output ? output[0] : 0;
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

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notif-id-123'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', WEEKLY: 'weekly' },
}));

// Mock expo-application
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
  applicationName: 'StrongerN',
  applicationId: 'com.strongern',
}));





