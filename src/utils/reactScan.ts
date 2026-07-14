/**
 * React Scan Performance Monitoring Toggle
 * 
 * Instructions for AI / Developers:
 * - To ENABLE React Scan performance monitoring: Set `REACT_SCAN_ENABLED = true`
 * - To DISABLE React Scan performance monitoring: Set `REACT_SCAN_ENABLED = false`
 * 
 * React Scan helps identify unnecessary component re-renders and performance bottlenecks.
 * See: https://github.com/aidenybai/react-scan
 */

import { scan } from 'react-scan';

// ============================================================================
// ⚡ TOGGLE REACT SCAN HERE ⚡
// Set to `true` to enable performance scanning, or `false` to disable.
// ============================================================================
export const REACT_SCAN_ENABLED = false;

/**
 * Initializes React Scan if running in development mode and `REACT_SCAN_ENABLED` is true.
 */
export function initReactScan(): void {
  if (__DEV__ && REACT_SCAN_ENABLED) {
    try {
      scan({
        enabled: true,
        log: true,
      });
      console.log('[ReactScan] Performance monitoring initialized.');
    } catch (error) {
      console.warn('[ReactScan] Initialization warning/error:', error);
    }
  }
}

// Automatically trigger initialization when this module is imported
initReactScan();
