// utils/renderTracker.ts
// Precision component render tracking engine for React performance verification

import { useRef, useEffect } from 'react';

class RenderTrackerStore {
  private counts: Map<string, number> = new Map();

  recordRender(componentName: string) {
    if (process.env.NODE_ENV === 'production' && typeof __DEV__ !== 'undefined' && !__DEV__) return;
    const current = this.counts.get(componentName) || 0;
    this.counts.set(componentName, current + 1);
  }

  getRenderCount(componentName: string): number {
    return this.counts.get(componentName) || 0;
  }

  getAllCounts(): Record<string, number> {
    const obj: Record<string, number> = {};
    this.counts.forEach((count, key) => {
      obj[key] = count;
    });
    return obj;
  }

  reset() {
    this.counts.clear();
  }
}

export const renderTracker = new RenderTrackerStore();

export function useTrackRender(componentName: string, id?: string) {
  if (process.env.NODE_ENV === 'production' && typeof __DEV__ !== 'undefined' && !__DEV__) {
    return;
  }
  const key = id ? `${componentName}:${id}` : componentName;
  renderTracker.recordRender(key);

  const renderCount = useRef(0);
  renderCount.current += 1;

  if (process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_E2E !== 'true') {
    // Log to console for performance benchmark parsing
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        console.log(`[RENDER_TRACKER] ${key} rendered (count: ${renderCount.current})`);
      }
    } catch (_) {}
  }
}
