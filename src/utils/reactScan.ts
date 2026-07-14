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
export const REACT_SCAN_ENABLED = false;

/**
 * Initializes React Scan overlay for web browsers.
 */
export function initReactScan(): void {
  if (typeof window === 'undefined') {
    // React Scan overlay is designed for browser DOM environment
    return;
  }

  if (REACT_SCAN_ENABLED) {
    try {
      scan({
        enabled: true,
        showToolbar: true,
        dangerouslyForceRunInProduction: true, // Ensures overlay activates regardless of bundler ENV flag
        log: true,
      });
      console.log('[ReactScan] ⚡ Performance monitoring overlay initialized.');
    } catch (error) {
      console.warn('[ReactScan] Initialization warning:', error);
    }
  }
}

// Automatically initialize on module import
initReactScan();
