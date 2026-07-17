/**
 * React Scan Performance Monitoring Toggle (Web Implementation)
 * 
 * React Scan displays a visual toolbar and highlights re-renders in web browsers.
 * See: https://github.com/aidenybai/react-scan
 */

import { scan } from 'react-scan';

export const REACT_SCAN_ENABLED = typeof process !== 'undefined' && process.env.EXPO_PUBLIC_E2E === 'true' ? false : true;

/**
 * Initializes React Scan overlay for web browsers.
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
        dangerouslyForceRunInProduction: true,
        log: true,
      });

      if (!document.getElementById('react-scan-script')) {
        const script = document.createElement('script');
        script.id = 'react-scan-script';
        script.src = 'https://unpkg.com/react-scan/dist/auto.global.js';
        script.async = false;
        (document.head || document.documentElement).appendChild(script);
      }

      console.log('[ReactScan] ⚡ Web performance monitoring overlay active.');
    } catch (error) {
      console.warn('[ReactScan] Initialization warning:', error);
    }
  }
}

// Automatically initialize on web import
initReactScan();
