// src/storage/adapters/mmkvAdapter.ts
// Guarded bootstrap adapter for MMKV V4 hot-path storage.
// Uses createMMKV and .remove() API. Synchronous native operations.
// Throws DurableStorageUnavailableError when native storage fails (no fake success).

import { Platform } from 'react-native';
import { setStorageHealthState } from '../healthState';

export class DurableStorageUnavailableError extends Error {
  constructor(message: string) {
    super(`[DurableStorageUnavailableError] ${message}`);
    this.name = 'DurableStorageUnavailableError';
  }
}

export interface SynchronousStorageAdapter {
  isAvailable(): boolean;
  isNative(): boolean;
  getString(key: string): string | null;
  setString(key: string, value: string): boolean;
  removeItem(key: string): boolean;
}

let mmkvInstance: any = null;
let isInitialized = false;
let isNativeMMKV = false;
let injectedAdapter: SynchronousStorageAdapter | null = null;
let webAdapter: SynchronousStorageAdapter | null = null;

function createWebStorageAdapter(): SynchronousStorageAdapter | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return {
      isAvailable: () => true,
      isNative: () => false,
      getString: (key) => window.localStorage.getItem(key),
      setString: (key, value) => {
        window.localStorage.setItem(key, value);
        return window.localStorage.getItem(key) === value;
      },
      removeItem: (key) => {
        window.localStorage.removeItem(key);
        return window.localStorage.getItem(key) === null;
      },
    };
  } catch {
    return null;
  }
}

/**
 * Allows injecting a custom synchronous storage adapter (e.g. for Web, Jest unit isolation).
 */
export function setInjectedStorageAdapter(adapter: SynchronousStorageAdapter | null): void {
  injectedAdapter = adapter;
  if (adapter) {
    isInitialized = true;
    isNativeMMKV = adapter.isNative();
  }
}

export function initMMKVAdapter(): boolean {
  if (isInitialized && !injectedAdapter) {
    return Boolean(webAdapter?.isAvailable() || (isNativeMMKV && mmkvInstance));
  }

  if (injectedAdapter) {
    isInitialized = true;
    isNativeMMKV = injectedAdapter.isNative();
    return true;
  }

  if (Platform.OS === 'web') {
    webAdapter = createWebStorageAdapter();
    isInitialized = true;
    isNativeMMKV = false;
    if (webAdapter) {
      setStorageHealthState('ready', { mmkvAvailable: false, lastError: null });
      return true;
    }
    setStorageHealthState('legacy_safe_mode', { mmkvAvailable: false, lastError: 'Web localStorage unavailable' });
    return false;
  }

  try {
    const { createMMKV } = require('react-native-mmkv');
    if (typeof createMMKV === 'function') {
      mmkvInstance = createMMKV({ id: 'strongern-hot-path' });
      isNativeMMKV = true;
      isInitialized = true;
      setStorageHealthState('ready', { mmkvAvailable: true, lastError: null });
      return true;
    }
  } catch (err: any) {
    const msg = err?.message || 'MMKV createMMKV unavailable';
    console.warn(`[MMKVAdapter] Native MMKV v4 initialization failed: ${msg}`);
  }

  mmkvInstance = null;
  isNativeMMKV = false;
  isInitialized = true;
  setStorageHealthState('legacy_safe_mode', { mmkvAvailable: false, lastError: 'Native MMKV missing' });
  return false;
}

export const mmkvStorageAdapter: SynchronousStorageAdapter = {
  isAvailable(): boolean {
    if (injectedAdapter) return injectedAdapter.isAvailable();
    if (!isInitialized) initMMKVAdapter();
    return Boolean(webAdapter?.isAvailable() || (isNativeMMKV && mmkvInstance));
  },

  isNative(): boolean {
    if (injectedAdapter) return injectedAdapter.isNative();
    return isNativeMMKV;
  },

  getString(key: string): string | null {
    if (injectedAdapter) return injectedAdapter.getString(key);
    if (!isInitialized) initMMKVAdapter();
    if (webAdapter) return webAdapter.getString(key);

    if (!isNativeMMKV || !mmkvInstance) {
      throw new DurableStorageUnavailableError(`MMKV storage unavailable for getString("${key}")`);
    }

    try {
      const val = mmkvInstance.getString(key);
      return val ?? null;
    } catch (err: any) {
      throw new DurableStorageUnavailableError(`MMKV getString error for "${key}": ${err?.message}`);
    }
  },

  setString(key: string, value: string): boolean {
    if (injectedAdapter) return injectedAdapter.setString(key, value);
    if (!isInitialized) initMMKVAdapter();
    if (webAdapter) {
      if (!webAdapter.setString(key, value)) {
        throw new DurableStorageUnavailableError(`Web storage write verification failed for "${key}"`);
      }
      return true;
    }

    if (!isNativeMMKV || !mmkvInstance) {
      throw new DurableStorageUnavailableError(`MMKV storage unavailable for setString("${key}")`);
    }

    try {
      mmkvInstance.set(key, value);
      // Synchronous readback check
      const readBack = mmkvInstance.getString(key);
      if (readBack !== value) {
        throw new DurableStorageUnavailableError(`MMKV write verification failed for "${key}"`);
      }
      return true;
    } catch (err: any) {
      if (err instanceof DurableStorageUnavailableError) throw err;
      throw new DurableStorageUnavailableError(`MMKV setString error for "${key}": ${err?.message}`);
    }
  },

  removeItem(key: string): boolean {
    if (injectedAdapter) return injectedAdapter.removeItem(key);
    if (!isInitialized) initMMKVAdapter();
    if (webAdapter) {
      if (!webAdapter.removeItem(key)) {
        throw new DurableStorageUnavailableError(`Web storage remove verification failed for "${key}"`);
      }
      return true;
    }

    if (!isNativeMMKV || !mmkvInstance) {
      throw new DurableStorageUnavailableError(`MMKV storage unavailable for removeItem("${key}")`);
    }

    try {
      // MMKV V4 uses .remove(key)
      if (typeof mmkvInstance.remove !== 'function') {
        throw new DurableStorageUnavailableError('MMKV V4 remove API is unavailable');
      }
      mmkvInstance.remove(key);
      const readBack = mmkvInstance.getString(key);
      if (readBack !== undefined && readBack !== null) {
        throw new DurableStorageUnavailableError(`MMKV remove verification failed for "${key}"`);
      }
      return true;
    } catch (err: any) {
      if (err instanceof DurableStorageUnavailableError) throw err;
      throw new DurableStorageUnavailableError(`MMKV removeItem error for "${key}": ${err?.message}`);
    }
  },
};
