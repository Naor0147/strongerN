import { Platform, Share, Clipboard } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import * as Application from 'expo-application';

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
const CURRENT_APP_VERSION = Application.nativeApplicationVersion || '1.0.0.98';

export async function getCrashLogs(): Promise<CrashLog[]> {
  const isWeb = Platform.OS === 'web';
  if (isWeb) {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(CRASH_LOGS_KEY);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  }

  let sqliteLogs: CrashLog[] = [];
  try {
    const sqliteDb = await SQLite.openDatabaseAsync('strongern_crashes.db');
    await sqliteDb.execAsync(`
      CREATE TABLE IF NOT EXISTS strongern_kv_store (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    const row = await sqliteDb.getFirstAsync(
      `SELECT value FROM strongern_kv_store WHERE key = ?;`,
      [CRASH_LOGS_KEY]
    );
    if (row && (row as any).value) {
      sqliteLogs = JSON.parse((row as any).value);
    }
  } catch (e) {
    console.error('[CrashLogger] Failed to read crash logs from SQLite:', e);
  }

  let fileLogs: CrashLog[] = [];
  try {
    const fileUri = `${FileSystem.documentDirectory}strongern_crash_logs.json`;
    const exists = await FileSystem.getInfoAsync(fileUri);
    if (exists.exists) {
      const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
      if (content) {
        fileLogs = JSON.parse(content);
      }
    }
  } catch (e) {}

  const map = new Map<string, CrashLog>();
  for (const l of [...sqliteLogs, ...fileLogs]) {
    if (l && l.id) map.set(l.id, l);
  }
  const combined = Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return combined;
}

export async function saveCrashLogs(logs: CrashLog[]): Promise<boolean> {
  const isWeb = Platform.OS === 'web';
  const serialized = JSON.stringify(logs);
  if (isWeb) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CRASH_LOGS_KEY, serialized);
      return true;
    }
    return false;
  }

  try {
    const fileUri = `${FileSystem.documentDirectory}strongern_crash_logs.json`;
    await FileSystem.writeAsStringAsync(fileUri, serialized, {
      encoding: FileSystem.EncodingType.UTF8,
    }).catch(() => {});

    const sqliteDb = await SQLite.openDatabaseAsync('strongern_crashes.db');
    await sqliteDb.execAsync(`
      CREATE TABLE IF NOT EXISTS strongern_kv_store (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    await sqliteDb.runAsync(
      `INSERT OR REPLACE INTO strongern_kv_store (key, value) VALUES (?, ?);`,
      [CRASH_LOGS_KEY, serialized]
    );
    return true;
  } catch (e) {
    console.error('[CrashLogger] Failed to save crash logs to SQLite:', e);
    return false;
  }
}

/**
 * Synchronously writes a crash log directly to storage.
 * Critical for fatal crashes, ensuring logs persist across SQLite and FileSystem.
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
      // 1. FileSystem fallback persistence for Native (Android/iOS)
      if (FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}strongern_crash_logs.json`;
        FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 })
          .then((content) => {
            let existing: CrashLog[] = [];
            if (content) {
              try {
                existing = JSON.parse(content);
              } catch (e) {}
            }
            const updated = [newLog, ...existing].slice(0, 100);
            return FileSystem.writeAsStringAsync(fileUri, JSON.stringify(updated), { encoding: FileSystem.EncodingType.UTF8 });
          })
          .catch(() => {
            FileSystem.writeAsStringAsync(fileUri, JSON.stringify([newLog]), { encoding: FileSystem.EncodingType.UTF8 }).catch(() => {});
          });
      }

      // 2. Native SQLite path
      let sqliteDb: any = null;
      try {
        sqliteDb = SQLite.openDatabaseSync('strongern_crashes.db');
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

        sqliteDb.runSync(
          `INSERT OR REPLACE INTO strongern_kv_store (key, value) VALUES (?, ?);`,
          [CRASH_LOGS_KEY, serialized]
        );
        console.log('[CrashLogger] Sync crash log saved to SQLite & FileSystem.');
      }
    }
  } catch (err) {
    console.warn('[CrashLogger] Critical failure inside saveCrashLogSync:', err);
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

  // Hook console.error for debounced sync persistence
  const originalConsoleError = console.error;
  let lastLoggedMsg = '';
  let lastLoggedTime = 0;
  // Re-entrancy guard: prevents saveCrashLogSync from recursively triggering this hook
  // when SQLite itself fails (NullPointerException → console.error → saveCrashLogSync → loop).
  let isSavingCrashLog = false;

  console.error = (...args: any[]) => {
    try {
      // If we are already inside saveCrashLogSync, skip to avoid infinite recursion.
      if (isSavingCrashLog) {
        originalConsoleError.apply(console, args);
        return;
      }
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      const now = Date.now();
      // Skip messages originating from the crash logger itself to avoid loops.
      if (!msg.startsWith('[CrashLogger]') && !msg.startsWith('[DB]') && (msg !== lastLoggedMsg || now - lastLoggedTime > 1000)) {
        lastLoggedMsg = msg;
        lastLoggedTime = now;
        isSavingCrashLog = true;
        try {
          saveCrashLogSync('console.error: ' + msg, '', false);
        } finally {
          isSavingCrashLog = false;
        }
      }
    } catch (e) {}
    originalConsoleError.apply(console, args);
  };

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
