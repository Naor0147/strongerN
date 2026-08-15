(global as any).__STARTUP_T0__ = Date.now();

if (typeof window !== 'undefined') {
  if (window.location?.search?.includes('e2e=true') || window.sessionStorage?.getItem('is_e2e_mode') === 'true' || window.localStorage?.getItem('is_e2e_mode') === 'true') {
    (window as any).__IS_E2E__ = true;
    try {
      window.sessionStorage?.setItem('is_e2e_mode', 'true');
      window.localStorage?.setItem('is_e2e_mode', 'true');
    } catch (e) {}
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
