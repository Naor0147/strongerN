/**
 * React Scan Performance Monitoring Toggle
 * 
 * Instructions for AI / Developers:
 * - To ENABLE React Scan performance monitoring: Set `REACT_SCAN_ENABLED = true`
 * - To DISABLE React Scan performance monitoring: Set `REACT_SCAN_ENABLED = false`
 * 
 * React Scan displays a visual toolbar and highlights re-renders in web browsers.
 * See: https://github.com/aidenybai/react-scan
 */

import { scan } from 'react-scan';

// ============================================================================
// ⚡ TOGGLE REACT SCAN HERE ⚡
// Set to `true` to enable performance scanning overlay, or `false` to disable.
// ============================================================================
export const REACT_SCAN_ENABLED = true;

/**
 * Initializes React Scan overlay for web browsers.
 */
export function initReactScan(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (REACT_SCAN_ENABLED) {
    try {
      // 1. Initialize react-scan programmatic API
      scan({
        enabled: true,
        showToolbar: true,
        dangerouslyForceRunInProduction: true,
        log: true,
      });

      // 2. Inject React-Scan script tag into document head to guarantee initialization under Expo Metro Web
      if (!document.getElementById('react-scan-script')) {
        const script = document.createElement('script');
        script.id = 'react-scan-script';
        script.src = 'https://unpkg.com/react-scan/dist/auto.global.js';
        script.async = false; // Synchronous execution to hook React DevTools global hook
        (document.head || document.documentElement).appendChild(script);
      }

      console.log('[ReactScan] ⚡ Performance monitoring overlay active.');
    } catch (error) {
      console.warn('[ReactScan] Initialization warning:', error);
    }
  }
}

// Automatically initialize on module import
initReactScan();
