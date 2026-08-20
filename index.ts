(global as any).__STARTUP_T0__ = Date.now();

if (typeof window !== 'undefined' && process.env.EXPO_PUBLIC_E2E === 'true') {
  if (window.location?.search?.includes('e2e=true')) {
    (window as any).__IS_E2E__ = true;
  }
}

import 'react-native-gesture-handler';
import './src/utils/reactScan'; // React Scan performance monitor toggle
import './src/utils/alertOverride'; // Override Alert.alert globally
import './src/utils/crashLogger'; // Initialize global error trackers
import './src/utils/foregroundNotification'; // Register Android foreground service headless task runner
import { registerRootComponent } from 'expo';

import App from './src/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
