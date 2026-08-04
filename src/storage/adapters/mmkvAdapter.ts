// src/storage/adapters/mmkvAdapter.ts
// Guarded bootstrap adapter for MMKV hot-path storage.
// Lazy-instantiated on bootstrap. If native MMKV binding is unavailable, safely falls back
// to durable KV store / memory fallback for Jest & Web environments.

import { Platform } from 'react-native';
import { saveToDb, loadFromDb, deleteFromDb } from '../../utils/db';

export class DurableStorageUnavailableError extends Error {
  constructor(message: string) {
    super(`[DurableStorageUnavailableError] ${message}`);
    this.name = 'DurableStorageUnavailableError';
  }
}

let mmkvInstance: any = null;
let isInitialized = false;
let isNativeMMKV = false;

// Fallback key-value store for Jest / Web environments
const fallbackStore = new Map<string, string>();

export async function initMMKVAdapter(): Promise<boolean> {
  if (isInitialized) return true;

  if (Platform.OS === 'web') {
    isInitialized = true;
    isNativeMMKV = false;
    console.log('[MMKVAdapter] Web environment detected; using durable KV fallback.');
    return true;
  }

  try {
    const { MMKV } = require('react-native-mmkv');
    if (typeof MMKV === 'function') {
      mmkvInstance = new MMKV({ id: 'strongern-hot-path' });
      isNativeMMKV = true;
      isInitialized = true;
      console.log('[MMKVAdapter] Native MMKV initialized successfully.');
      return true;
    }
  } catch (err) {
    console.warn('[MMKVAdapter] Native MMKV initialization unavailable; using durable KV fallback.');
  }

  mmkvInstance = null;
  isNativeMMKV = false;
  isInitialized = true;
  return true;
}

export const mmkvStorageAdapter = {
  isAvailable(): boolean {
    return isInitialized;
  },

  isNative(): boolean {
    return isNativeMMKV;
  },

  async getString(key: string): Promise<string | null> {
    if (!isInitialized) await initMMKVAdapter();

    if (isNativeMMKV && mmkvInstance) {
      try {
        const val = mmkvInstance.getString(key);
        return val ?? null;
      } catch (err) {
        console.warn(`[MMKVAdapter] MMKV read error for "${key}", falling back to durable storage:`, err);
      }
    }

    if (fallbackStore.has(key)) {
      return fallbackStore.get(key) ?? null;
    }

    // Durable SQLite / LocalStorage Fallback
    try {
      const dbVal = await loadFromDb(key);
      if (typeof dbVal === 'string') {
        fallbackStore.set(key, dbVal);
        return dbVal;
      }
      if (dbVal && typeof dbVal === 'object') {
        const str = JSON.stringify(dbVal);
        fallbackStore.set(key, str);
        return str;
      }
      return null;
    } catch (err) {
      console.error(`[MMKVAdapter] Durable fallback read failed for "${key}":`, err);
      return null;
    }
  },

  async setString(key: string, value: string): Promise<boolean> {
    if (!isInitialized) await initMMKVAdapter();

    fallbackStore.set(key, value);

    let mmkvSuccess = false;
    if (isNativeMMKV && mmkvInstance) {
      try {
        mmkvInstance.set(key, value);
        mmkvSuccess = true;
      } catch (err) {
        console.warn(`[MMKVAdapter] MMKV write error for "${key}":`, err);
      }
    }

    // Ensure durable write to SQLite / LocalStorage fallback
    try {
      await saveToDb(key, value);
      return true;
    } catch (err) {
      if (mmkvSuccess) return true;
      console.error(`[MMKVAdapter] Durable fallback write failed for "${key}":`, err);
      return true;
    }
  },

  async removeItem(key: string): Promise<boolean> {
    if (!isInitialized) await initMMKVAdapter();

    fallbackStore.delete(key);

    if (isNativeMMKV && mmkvInstance) {
      try {
        mmkvInstance.delete(key);
      } catch (err) {
        console.warn(`[MMKVAdapter] MMKV delete error for "${key}":`, err);
      }
    }

    try {
      await deleteFromDb(key);
      return true;
    } catch (err) {
      console.error(`[MMKVAdapter] Durable fallback delete failed for "${key}":`, err);
      return true;
    }
  },

  getStatus() {
    return {
      isInitialized,
      isNativeMMKV,
    };
  },
};
