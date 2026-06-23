import { Platform, Share, Clipboard } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { saveToDb, loadFromDb } from './db';

export interface CrashLog {
  id: string;
  timestamp: string;
  message: string;
  stack: string;
  fatal: boolean;
  platform: string;
  version: string;
}

const CRASH_LOGS_KEY = 'crash_logs';
const CURRENT_APP_VERSION = '1.0.0.40';

export async function getCrashLogs(): Promise<CrashLog[]> {
  try {
    const logs = await loadFromDb(CRASH_LOGS_KEY);
    return Array.isArray(logs) ? logs : [];
  } catch (e) {
    console.error('[CrashLogger] Failed to read crash logs from DB:', e);
    return [];
  }
}

export async function saveCrashLogs(logs: CrashLog[]): Promise<boolean> {
  try {
    return await saveToDb(CRASH_LOGS_KEY, logs);
  } catch (e) {
    console.error('[CrashLogger] Failed to save crash logs to DB:', e);
    return false;
  }
}

/**
 * Synchronously writes a crash log directly to storage.
 * This is critical for fatal crashes, as the JS thread will be terminated
 * immediately after the error handler runs, preventing any async promises from completing.
 */
export function saveCrashLogSync(message: string, stack: string, fatal: boolean): void {
  try {
    const timestamp = new Date().toISOString();
    const platform = Platform.OS;

    const newLog: CrashLog = {
      id: Math.random().toString(36).substring(2, 9) + Date.now(),
      timestamp,
      message: message || 'Unknown Error',
      stack: stack || 'No stack trace available',
      fatal,
      platform,
      version: CURRENT_APP_VERSION,
    };

    const isWeb = Platform.OS === 'web';
    let logs: CrashLog[] = [];

    if (isWeb) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(CRASH_LOGS_KEY);
        if (saved) {
          try {
            logs = JSON.parse(saved);
          } catch (e) {}
        }
        const updated = [newLog, ...logs].slice(0, 100);
        window.localStorage.setItem(CRASH_LOGS_KEY, JSON.stringify(updated));
      }
    } else {
      // Native SQLite path
      let sqliteDb: any = null;
      try {
        sqliteDb = SQLite.openDatabaseSync('strongern.db');
        sqliteDb.execSync(`
          CREATE TABLE IF NOT EXISTS strongern_kv_store (
            key TEXT PRIMARY KEY,
            value TEXT
          );
        `);
      } catch (err) {
        console.warn('[CrashLogger] Failed to open SQLite sync:', err);
      }

      if (sqliteDb) {
        // Read existing logs synchronously
        let existingVal: string | null = null;
        try {
          const row: any = sqliteDb.getFirstSync(
            `SELECT value FROM strongern_kv_store WHERE key = ?;`,
            [CRASH_LOGS_KEY]
          );
          if (row) {
            existingVal = row.value;
          }
        } catch (e) {
          console.warn('[CrashLogger] Failed to read crash_logs sync:', e);
        }

        if (existingVal) {
          try {
            logs = JSON.parse(existingVal);
          } catch (e) {}
        }

        const updated = [newLog, ...logs].slice(0, 100);
        const serialized = JSON.stringify(updated);

        // Write logs back synchronously
        sqliteDb.runSync(
          `INSERT OR REPLACE INTO strongern_kv_store (key, value) VALUES (?, ?);`,
          [CRASH_LOGS_KEY, serialized]
        );
        console.log('[CrashLogger] Sync crash log saved to SQLite.');
      } else {
        // Fallback to localStorage on native if SQLite failed
        if (typeof window !== 'undefined' && window.localStorage) {
          const saved = window.localStorage.getItem(CRASH_LOGS_KEY);
          if (saved) {
            try {
              logs = JSON.parse(saved);
            } catch (e) {}
          }
          const updated = [newLog, ...logs].slice(0, 100);
          window.localStorage.setItem(CRASH_LOGS_KEY, JSON.stringify(updated));
        }
      }
    }
  } catch (err) {
    console.error('[CrashLogger] Critical failure inside saveCrashLogSync:', err);
  }
}

export async function addCrashLog(message: string, stack: string, fatal: boolean): Promise<void> {
  // Directly delegate to the synchronous method to ensure data safety
  saveCrashLogSync(message, stack, fatal);
}

export async function deleteCrashLog(id: string): Promise<void> {
  try {
    const logs = await getCrashLogs();
    const updated = logs.filter((log) => log.id !== id);
    await saveCrashLogs(updated);
  } catch (e) {
    console.error('[CrashLogger] Failed to delete crash log:', e);
  }
}

export async function clearCrashLogs(): Promise<void> {
  await saveCrashLogs([]);
}

export async function exportCrashLogsToFile(): Promise<boolean> {
  try {
    const logs = await getCrashLogs();
    const json = JSON.stringify(logs, null, 2);
    const filename = `strongern_crash_logs_${new Date().toISOString().slice(0, 10)}.json`;

    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }

    const filePath = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Share.share({
      title: filename,
      url: filePath,
      message: `strongerN Crash Logs — Generated: ${new Date().toLocaleString()}`,
    });
    return true;
  } catch (e: any) {
    console.error('[CrashLogger] Export failed:', e);
    if (e?.message?.includes('cancel') || e?.message?.includes('dismiss')) {
      return true;
    }
    return false;
  }
}

export function copyCrashLogToClipboard(log: CrashLog): void {
  const formatted = `[CRASH LOG]
Timestamp: ${log.timestamp}
Message: ${log.message}
Fatal: ${log.fatal}
Platform: ${log.platform}
Version: ${log.version}

Stack Trace:
${log.stack}`;

  Clipboard.setString(formatted);
}

// Global hook registration
let isInitialized = false;

export function initCrashLogger(): void {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[CrashLogger] Initializing global error catchers...');

  // Hook JS Exceptions
  if (typeof ErrorUtils !== 'undefined') {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? (error.stack || '') : '';
      
      // Synchronously write the crash log to guarantee it persists before termination
      saveCrashLogSync(message, stack, !!isFatal);

      // Call original handler (with a brief delay if fatal to let threads settle, or immediately in dev)
      if (isFatal && !__DEV__) {
        setTimeout(() => {
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        }, 150);
      } else {
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      }
    });
  }

  // Hook Unhandled Promise Rejections
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: any) => {
        const message = `Unhandled Rejection: ${error?.message || String(error)}`;
        const stack = error?.stack || '';
        saveCrashLogSync(message, stack, false);
      },
      onHandled: () => {},
    });
  } catch (e) {
    // Rejection tracking module may not be available on all JS runtimes
  }
}

// Automatically initialize when imported
initCrashLogger();
