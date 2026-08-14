// src/storage/compactSettings.ts
// Decoupled MMKV Compact Settings Storage (Hot Path) for StrongerN.
// Persists user preferences, toggles, sound settings, themes into MMKV SETTINGS_COMPACT_V2 ('strongern_settings_v2').

import { mmkvStorageAdapter } from './adapters/mmkvAdapter';
import { STORAGE_KEYS } from './keys';
import { AppSettingsCompactV2 } from './contracts/types';

/**
 * Loads compact app settings synchronously from MMKV storage.
 * Returns null if uninitialized or unavailable.
 */
export function loadCompactSettings(): AppSettingsCompactV2 | null {
  try {
    if (!mmkvStorageAdapter.isAvailable()) return null;
    const raw = mmkvStorageAdapter.getString(STORAGE_KEYS.SETTINGS_COMPACT_V2);
    if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AppSettingsCompactV2;
    }
    return null;
  } catch (error) {
    console.warn('[CompactSettings] Failed to load compact settings:', error);
    return null;
  }
}

/**
 * Saves or updates compact app settings synchronously in MMKV storage.
 * Performs a shallow merge with existing compact settings.
 */
export function saveCompactSettings(settings: Partial<AppSettingsCompactV2>): boolean {
  try {
    if (!mmkvStorageAdapter.isAvailable()) return false;
    const existing = loadCompactSettings() || {};
    const merged: AppSettingsCompactV2 = {
      ...existing,
      ...settings,
    };
    return mmkvStorageAdapter.setString(STORAGE_KEYS.SETTINGS_COMPACT_V2, JSON.stringify(merged));
  } catch (error) {
    console.warn('[CompactSettings] Failed to save compact settings:', error);
    return false;
  }
}

/**
 * Removes compact settings from MMKV storage.
 */
export function clearCompactSettings(): boolean {
  try {
    if (!mmkvStorageAdapter.isAvailable()) return false;
    return mmkvStorageAdapter.removeItem(STORAGE_KEYS.SETTINGS_COMPACT_V2);
  } catch (error) {
    console.warn('[CompactSettings] Failed to clear compact settings:', error);
    return false;
  }
}
