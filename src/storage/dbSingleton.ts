// src/storage/dbSingleton.ts
// Singleton database manager for StrongerN relational SQLite database.
// Controls connection lifecycle, PRAGMA setup (WAL, foreign_keys, busy_timeout), and migrations.

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { STORAGE_KEYS } from './keys';

let v2DbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;

export async function getV2Database(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  if (v2DbInstance) return v2DbInstance;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const openedDb = await SQLite.openDatabaseAsync(STORAGE_KEYS.RELATIONAL_V2_DB);
        await openedDb.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;
          PRAGMA busy_timeout = 5000;
        `);
        v2DbInstance = openedDb;
        console.log('[DBSingleton] V2 SQLite database connection established with WAL enabled.');
        return v2DbInstance;
      } catch (err) {
        console.error('[DBSingleton] Failed to initialize V2 SQLite database connection:', err);
        v2DbInstance = null;
        return null;
      } finally {
        initPromise = null;
      }
    })();
  }

  return initPromise;
}

export async function closeV2Database(): Promise<void> {
  if (v2DbInstance) {
    try {
      await v2DbInstance.closeAsync();
    } catch (e) {
      console.warn('[DBSingleton] Error closing V2 DB connection:', e);
    } finally {
      v2DbInstance = null;
    }
  }
}
