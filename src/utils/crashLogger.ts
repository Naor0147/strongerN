import { Platform, Share, InteractionManager, AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import * as Application from 'expo-application';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

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
export const DEFAULT_APP_VERSION = '1.0.1.87';
const CURRENT_APP_VERSION = Application.nativeApplicationVersion || DEFAULT_APP_VERSION;

let memoryCrashQueue: CrashLog[] = [];
let flushTimeout: any = null;
let isFlushing = false;
let flushFailures = 0;
const MAX_FLUSH_RETRIES = 3;

let customSaveCrashLogsHandler: ((logs: CrashLog[]) => Promise<boolean>) | null = null;

export function setCustomSaveCrashLogsHandlerForTesting(handler: ((logs: CrashLog[]) => Promise<boolean>) | null): void {
  customSaveCrashLogsHandler = handler;
}

export function resetFlushFailures(): void {
  flushFailures = 0;
}

export function scheduleCrashQueueFlush(delayMs = 2000): void {
  if (flushTimeout) return;

  let fallbackTimer: any = null;
  let interactionHandle: any = null;

  const triggerFlush = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (interactionHandle) {
      interactionHandle.cancel?.();
      interactionHandle = null;
    }
    flushTimeout = null;
    flushCrashQueueAsync().catch(() => {});
  };

  if (typeof InteractionManager !== 'undefined' && InteractionManager.runAfterInteractions && delayMs <= 2000) {
    interactionHandle = InteractionManager.runAfterInteractions(() => {
      triggerFlush();
    });
    fallbackTimer = setTimeout(() => {
      triggerFlush();
    }, delayMs);
    flushTimeout = fallbackTimer;
  } else {
    flushTimeout = setTimeout(triggerFlush, delayMs);
  }
}

export async function flushCrashQueueAsync(): Promise<void> {
  if (isFlushing || memoryCrashQueue.length === 0) return;
  isFlushing = true;
  const logsToFlush = [...memoryCrashQueue];
  memoryCrashQueue = [];

  let flushSucceeded = false;
  try {
    const isWeb = Platform.OS === 'web';
    if (isWeb) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(CRASH_LOGS_KEY);
        const existing: CrashLog[] = saved ? JSON.parse(saved) : [];
        const map = new Map<string, CrashLog>();
        for (const l of [...logsToFlush, ...existing]) {
          if (l && l.id) map.set(l.id, l);
        }
        const combined = Array.from(map.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 100);
        window.localStorage.setItem(CRASH_LOGS_KEY, JSON.stringify(combined));
        flushSucceeded = true;
      }
    } else {
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
      } catch (e) {}

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
      for (const l of [...logsToFlush, ...sqliteLogs, ...fileLogs]) {
        if (l && l.id) map.set(l.id, l);
      }
      const combined = Array.from(map.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100);

      flushSucceeded = await saveCrashLogs(combined);
    }
  } catch (e) {
    flushSucceeded = false;
  } finally {
    if (flushSucceeded) {
      flushFailures = 0;
    } else if (logsToFlush.length > 0) {
      flushFailures++;
      memoryCrashQueue = [...logsToFlush, ...memoryCrashQueue].slice(-100);
      if (flushFailures <= MAX_FLUSH_RETRIES) {
        const backoffDelay = Math.min(2000 * Math.pow(4, flushFailures - 1), 60000); // 2s -> 8s -> 32s
        scheduleCrashQueueFlush(backoffDelay);
      } else {
        console.warn(`[CrashLogger] Max flush retries (${MAX_FLUSH_RETRIES}) reached. Queue kept in memory until next event.`);
      }
    }
    isFlushing = false;
  }
}

export async function getCrashLogs(): Promise<CrashLog[]> {
  const isWeb = Platform.OS === 'web';
  if (isWeb) {
    let savedLogs: CrashLog[] = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(CRASH_LOGS_KEY);
      savedLogs = saved ? JSON.parse(saved) : [];
    }
    const map = new Map<string, CrashLog>();
    for (const l of [...memoryCrashQueue, ...savedLogs]) {
      if (l && l.id) map.set(l.id, l);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
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
  for (const l of [...memoryCrashQueue, ...sqliteLogs, ...fileLogs]) {
    if (l && l.id) map.set(l.id, l);
  }
  const combined = Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return combined;
}

export async function saveCrashLogs(logs: CrashLog[]): Promise<boolean> {
  if (customSaveCrashLogsHandler) {
    return customSaveCrashLogsHandler(logs);
  }

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
  if (fatal) {
    saveCrashLogSync(message, stack, true);
  } else {
    const newLog: CrashLog = {
      id: Math.random().toString(36).substring(2, 9) + Date.now(),
      timestamp: new Date().toISOString(),
      message: message || 'Unknown Error',
      stack: stack || 'No stack trace available',
      fatal: false,
      platform: Platform.OS,
      version: CURRENT_APP_VERSION,
    };
    memoryCrashQueue.push(newLog);
    if (memoryCrashQueue.length > 100) memoryCrashQueue.shift();
    scheduleCrashQueueFlush();
  }
}

export async function deleteCrashLog(id: string): Promise<void> {
  try {
    memoryCrashQueue = memoryCrashQueue.filter((log) => log.id !== id);
    const logs = await getCrashLogs();
    const updated = logs.filter((log) => log.id !== id);
    await saveCrashLogs(updated);
  } catch (e) {
    console.error('[CrashLogger] Failed to delete crash log:', e);
  }
}

export async function clearCrashLogs(): Promise<void> {
  memoryCrashQueue = [];
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

    try {
      if (await Sharing.isAvailableAsync()) {
        let shareUri = filePath;
        if (Platform.OS === 'android') {
          try { shareUri = await FileSystem.getContentUriAsync(filePath); } catch {}
        }
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/json',
          dialogTitle: filename,
          UTI: 'public.json',
        });
        return true;
      }
    } catch (e: any) {
      if (e?.message?.includes('cancel') || e?.message?.includes('dismiss')) return true;
      console.warn('[CrashLogger] Sharing failed, falling back to Share', e);
    }

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

  try {
    Clipboard.setStringAsync(formatted);
  } catch {
    // fallback sync if needed
    (Clipboard as any).setString?.(formatted);
  }
}

// Global hook registration
let isInitialized = false;

export function initCrashLogger(): void {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[CrashLogger] Initializing global error catchers...');

  // Hook console.error for async queue persistence (zero JS-thread SQLite locking)
  const originalConsoleError = console.error;
  let lastLoggedMsg = '';
  let lastLoggedTime = 0;

  console.error = (...args: any[]) => {
    try {
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      const now = Date.now();
      // Skip messages originating from the crash logger itself to avoid loops.
      if (!msg.startsWith('[CrashLogger]') && !msg.startsWith('[DB]') && (msg !== lastLoggedMsg || now - lastLoggedTime > 1000)) {
        lastLoggedMsg = msg;
        lastLoggedTime = now;
        const newLog: CrashLog = {
          id: Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: new Date().toISOString(),
          message: 'console.error: ' + msg,
          stack: '',
          fatal: false,
          platform: Platform.OS,
          version: CURRENT_APP_VERSION,
        };
        memoryCrashQueue.push(newLog);
        if (memoryCrashQueue.length > 100) memoryCrashQueue.shift();
        scheduleCrashQueueFlush();
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

      if (isFatal) {
        // Synchronously write the crash log strictly for fatal crashes to guarantee persistence before process exit
        saveCrashLogSync(message, stack, true);
      } else {
        const newLog: CrashLog = {
          id: Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: new Date().toISOString(),
          message,
          stack,
          fatal: false,
          platform: Platform.OS,
          version: CURRENT_APP_VERSION,
        };
        memoryCrashQueue.push(newLog);
        if (memoryCrashQueue.length > 100) memoryCrashQueue.shift();
        scheduleCrashQueueFlush();
      }

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

  // Hook Unhandled Promise Rejections (non-fatal async queue)
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: any) => {
        const message = `Unhandled Rejection: ${error?.message || String(error)}`;
        const stack = error?.stack || '';
        const newLog: CrashLog = {
          id: Math.random().toString(36).substring(2, 9) + Date.now(),
          timestamp: new Date().toISOString(),
          message,
          stack,
          fatal: false,
          platform: Platform.OS,
          version: CURRENT_APP_VERSION,
        };
        memoryCrashQueue.push(newLog);
        if (memoryCrashQueue.length > 100) memoryCrashQueue.shift();
        scheduleCrashQueueFlush();
      },
      onHandled: () => {},
    });
  } catch (e) {
    // Rejection tracking module may not be available on all JS runtimes
  }

  // Hook AppState changes to flush crash queue on app background
  try {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        flushCrashQueueAsync().catch(() => {});
      }
    });
  } catch (e) {}
}

// Automatically initialize when imported
initCrashLogger();

