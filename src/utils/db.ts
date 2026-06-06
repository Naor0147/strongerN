// utils/db.ts
// Local-first SQLite database interface with clean web fallback
import * as SQLite from 'expo-sqlite';

let db: any = null;
const TABLE_NAME = 'strongern_kv_store';

export async function initDb(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false; // Server side or unsupported
  }
  
  // Check if we are running in a Web browser environment
  const isWeb = typeof document !== 'undefined';
  if (isWeb) {
    console.log('[SQLite DB] Web environment detected. Falling back to local storage.');
    return true;
  }

  try {
    // Open SQLite Database
    db = SQLite.openDatabaseSync('strongern.db');
    
    // Create KV store table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('[SQLite DB] SQLite database initialized successfully.');
    return true;
  } catch (err) {
    console.warn('[SQLite DB] Failed to initialize SQLite database, using local storage fallback.', err);
    return false;
  }
}

export async function saveToDb(key: string, value: any): Promise<boolean> {
  const serialized = JSON.stringify(value);
  
  if (!db) {
    // Fallback to local storage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, serialized);
        return true;
      }
    } catch (e) {
      console.error('[LocalStorage Save Error]', e);
    }
    return false;
  }

  try {
    db.runSync(
      `INSERT OR REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?, ?);`,
      [key, serialized]
    );
    return true;
  } catch (err) {
    console.error('[SQLite DB Save Error]', err);
    // fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
      return true;
    }
    return false;
  }
}

export async function loadFromDb(key: string): Promise<any | null> {
  if (!db) {
    // Fallback to local storage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
      }
    } catch (e) {
      console.error('[LocalStorage Load Error]', e);
    }
    return null;
  }

  try {
    const row = db.getFirstSync(
      `SELECT value FROM ${TABLE_NAME} WHERE key = ?;`,
      [key]
    );
    return row ? JSON.parse(row.value) : null;
  } catch (err) {
    console.error('[SQLite DB Load Error]', err);
    // fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  }
}

export async function deleteFromDb(key: string): Promise<boolean> {
  if (!db) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return true;
      }
    } catch (e) {
      console.error('[LocalStorage Delete Error]', e);
    }
    return false;
  }

  try {
    db.runSync(
      `DELETE FROM ${TABLE_NAME} WHERE key = ?;`,
      [key]
    );
    return true;
  } catch (err) {
    console.error('[SQLite DB Delete Error]', err);
    return false;
  }
}
