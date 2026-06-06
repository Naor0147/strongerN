// utils/db.ts
// Local-first SQLite database interface with clean web fallback.
// On native (Android/iOS): uses expo-sqlite for persistent, reliable storage.
// On web: falls back to localStorage.
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let db: any = null;
const TABLE_NAME = 'strongern_kv_store';
const isWeb = Platform.OS === 'web';

export async function initDb(): Promise<boolean> {
  // ── Web: use localStorage, no SQLite ──────────────────────────────────────
  if (isWeb) {
    console.log('[DB] Web environment — using localStorage.');
    return true;
  }

  // ── Native: open SQLite database ──────────────────────────────────────────
  if (db) return true; // Already initialized

  try {
    db = SQLite.openDatabaseSync('strongern.db');
    db.execSync(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('[DB] SQLite initialized successfully.');
    return true;
  } catch (err) {
    console.warn('[DB] SQLite initialization failed, falling back to localStorage.', err);
    db = null;
    return true; // Still return true so the app can use localStorage fallback
  }
}

export async function saveToDb(key: string, value: any): Promise<boolean> {
  const serialized = JSON.stringify(value);

  // Native SQLite path
  if (!isWeb && db) {
    try {
      db.runSync(
        `INSERT OR REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?, ?);`,
        [key, serialized]
      );
      return true;
    } catch (err) {
      console.error('[DB] SQLite save error, trying localStorage fallback:', err);
      // Fall through to localStorage
    }
  }

  // Web / localStorage fallback
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
      return true;
    }
  } catch (e) {
    console.error('[DB] localStorage save error:', e);
  }
  return false;
}

export async function loadFromDb(key: string): Promise<any | null> {
  // Native SQLite path
  if (!isWeb && db) {
    try {
      const row = db.getFirstSync(
        `SELECT value FROM ${TABLE_NAME} WHERE key = ?;`,
        [key]
      );
      return row ? JSON.parse(row.value) : null;
    } catch (err) {
      console.error('[DB] SQLite load error, trying localStorage fallback:', err);
      // Fall through to localStorage
    }
  }

  // Web / localStorage fallback
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    }
  } catch (e) {
    console.error('[DB] localStorage load error:', e);
  }
  return null;
}

export async function deleteFromDb(key: string): Promise<boolean> {
  // Native SQLite path
  if (!isWeb && db) {
    try {
      db.runSync(`DELETE FROM ${TABLE_NAME} WHERE key = ?;`, [key]);
      return true;
    } catch (err) {
      console.error('[DB] SQLite delete error:', err);
      // Fall through to localStorage
    }
  }

  // Web / localStorage fallback
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return true;
    }
  } catch (e) {
    console.error('[DB] localStorage delete error:', e);
  }
  return false;
}

/**
 * Wipe all keys from the KV store (used for full data reset).
 */
export async function clearDb(): Promise<boolean> {
  if (!isWeb && db) {
    try {
      db.execSync(`DELETE FROM ${TABLE_NAME};`);
      return true;
    } catch (err) {
      console.error('[DB] SQLite clearDb error:', err);
    }
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
      return true;
    }
  } catch (e) {
    console.error('[DB] localStorage clear error:', e);
  }
  return false;
}
