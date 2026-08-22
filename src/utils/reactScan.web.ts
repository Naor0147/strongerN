/**
 * React Scan Performance Monitoring Toggle (Web Implementation)
 *
 * React Scan displays a visual toolbar and highlights re-renders in web browsers.
 * See: https://github.com/aidenybai/react-scan
 */

import { scan } from 'react-scan';

export const REACT_SCAN_ENABLED = process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_E2E !== 'true';

/**
 * Initializes React Scan overlay for web browsers in development.
 */
export function initReactScan(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (REACT_SCAN_ENABLED) {
    try {
      scan({
        enabled: true,
        showToolbar: true,
        log: true,
      });

      console.log('[ReactScan] ⚡ Web performance monitoring overlay active.');
    } catch (error) {
      console.warn('[ReactScan] Initialization warning:', error);
    }
  }
}

// Automatically initialize on web import
initReactScan();
