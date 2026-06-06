// utils/secureStore.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * Saves a key-value pair securely on native platforms.
 * Falls back to localStorage on Web.
 */
export async function setSecureItem(key: string, value: string): Promise<boolean> {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (e) {
      console.warn('[SecureStore Fallback Error] Failed to write to localStorage:', e);
    }
    return false;
  }

  try {
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch (err) {
    console.error('[SecureStore Error] Failed to set secure item:', err);
    // In-memory or localStorage fallback as ultimate resilience
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch {}
    return false;
  }
}

/**
 * Retrieves a secured key value.
 * Falls back to localStorage on Web.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('[SecureStore Fallback Error] Failed to read from localStorage:', e);
    }
    return null;
  }

  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (!isAvailable) {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error('[SecureStore Error] Failed to get secure item:', err);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return null;
  }
}

/**
 * Deletes a secured key.
 * Falls back to localStorage on Web.
 */
export async function deleteSecureItem(key: string): Promise<boolean> {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return true;
      }
    } catch (e) {
      console.warn('[SecureStore Fallback Error] Failed to remove from localStorage:', e);
    }
    return false;
  }

  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (err) {
    console.error('[SecureStore Error] Failed to delete secure item:', err);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return true;
      }
    } catch {}
    return false;
  }
}
