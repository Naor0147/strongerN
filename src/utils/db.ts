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
    const openedDb = await SQLite.openDatabaseAsync('strongern.db');
    await openedDb.execAsync(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    db = openedDb;
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

  // Dual-write to localStorage / memory cache as immediate synchronous backup
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
    }
  } catch (e) {}

  // Native SQLite path
  if (!isWeb) {
    if (!db) {
      await initDb();
    }
    if (db) {
      try {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?, ?);`,
          [key, serialized]
        );
        return true;
      } catch (err) {
        console.error('[DB] SQLite save error, fallback to localStorage used:', err);
      }
    }
  }

  return true;
}

export async function loadFromDb(key: string): Promise<any | null> {
  // Native SQLite path
  if (!isWeb) {
    if (!db) {
      await initDb();
    }
    if (db) {
      try {
        const row = await db.getFirstAsync(
          `SELECT value FROM ${TABLE_NAME} WHERE key = ?;`,
          [key]
        );
        if (row && row.value) {
          return JSON.parse(row.value);
        }
      } catch (err) {
        console.error('[DB] SQLite load error, checking localStorage fallback:', err);
      }
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
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (e) {}

  // Native SQLite path
  if (!isWeb && db) {
    try {
      await db.runAsync(`DELETE FROM ${TABLE_NAME} WHERE key = ?;`, [key]);
      return true;
    } catch (err) {
      console.error('[DB] SQLite delete error:', err);
    }
  }
  return true;
}

/**
 * Wipe all keys from the KV store (used for full data reset).
 */
async function clearDb(): Promise<boolean> {
  if (!isWeb && db) {
    try {
      await db.execAsync(`DELETE FROM ${TABLE_NAME};`);
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

