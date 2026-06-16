import { Platform, Share, Clipboard } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
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

export async function addCrashLog(message: string, stack: string, fatal: boolean): Promise<void> {
  try {
    const logs = await getCrashLogs();
    const newLog: CrashLog = {
      id: Math.random().toString(36).substring(2, 9) + Date.now(),
      timestamp: new Date().toISOString(),
      message: message || 'Unknown Error',
      stack: stack || 'No stack trace available',
      fatal,
      platform: Platform.OS,
      version: '1.0.0.13',
    };
    // Keep last 100 entries to prevent DB bloat
    const updated = [newLog, ...logs].slice(0, 100);
    await saveCrashLogs(updated);
  } catch (e) {
    console.error('[CrashLogger] Failed to append crash log:', e);
  }
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
      
      // Fire-and-forget DB write
      addCrashLog(message, stack, !!isFatal);

      // Call original handler (so react-native red box shows in dev, or crashes clean in prod)
      if (originalHandler) {
        originalHandler(error, isFatal);
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
        addCrashLog(message, stack, false);
      },
      onHandled: () => {},
    });
  } catch (e) {
    // Rejection tracking module may not be available on all JS runtimes
  }
}

// Automatically initialize when imported
initCrashLogger();
