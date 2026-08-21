// src/utils/oauthDiagnostics.ts
// Ring-buffer telemetry logger for Google OAuth and sign-in lifecycle events.
// Persists the last ~50 events to durable storage so logs survive app reloads/crashes.

import { Clipboard, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { safeMmkvGet, safeMmkvSet } from '../storage/instantCache';
import { saveToDb, loadFromDb } from './db';
import { STORAGE_KEYS } from '../storage/keys';

export type OAuthLogLevel = 'info' | 'ok' | 'error';

export interface OAuthLogEvent {
  id: string;
  timestamp: number;
  formattedTime: string;
  step: string;
  detail?: string;
  level: OAuthLogLevel;
}

const MAX_LOG_EVENTS = 50;
const OAUTH_KEY = (STORAGE_KEYS as any).OAUTH_DIAGNOSTICS_LOGS || 'strongern_oauth_diagnostics_logs';

type LogSubscriber = (logs: OAuthLogEvent[]) => void;
const subscribers = new Set<LogSubscriber>();

let inMemoryLogs: OAuthLogEvent[] = [];
let isHydrated = false;

function formatTimestamp(d: Date): string {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  const padMs = (n: number) => String(n).padStart(3, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${padMs(d.getMilliseconds())}`;
}

/**
 * Hydrate logs synchronously from MMKV cache if available.
 */
function hydrateFromStorage(): void {
  if (isHydrated) return;
  try {
    const cached = safeMmkvGet(OAUTH_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        inMemoryLogs = parsed.slice(-MAX_LOG_EVENTS);
        isHydrated = true;
        return;
      }
    }
  } catch (err) {
    // MMKV not available or invalid JSON, fall back to async DB
  }

  isHydrated = true;
  loadFromDb(OAUTH_KEY).then((saved) => {
    if (Array.isArray(saved) && inMemoryLogs.length === 0) {
      inMemoryLogs = saved.slice(-MAX_LOG_EVENTS);
      notifySubscribers();
    }
  }).catch(() => {});
}

function persistLogs(): void {
  try {
    const serialized = JSON.stringify(inMemoryLogs);
    safeMmkvSet(OAUTH_KEY, serialized);
  } catch {}

  saveToDb(OAUTH_KEY, inMemoryLogs).catch(() => {});
}

function notifySubscribers(): void {
  const currentLogs = [...inMemoryLogs];
  subscribers.forEach((cb) => {
    try {
      cb(currentLogs);
    } catch {}
  });
}

/**
 * Log a new OAuth lifecycle event.
 */
export function logOauthEvent(
  step: string,
  detail?: unknown,
  level: OAuthLogLevel = 'info'
): OAuthLogEvent {
  hydrateFromStorage();

  const now = new Date();
  const detailStr = detail !== undefined
    ? (typeof detail === 'string' ? detail : (detail instanceof Error ? detail.message : JSON.stringify(detail)))
    : undefined;

  const event: OAuthLogEvent = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now.getTime(),
    formattedTime: formatTimestamp(now),
    step,
    detail: detailStr,
    level,
  };

  inMemoryLogs.push(event);
  if (inMemoryLogs.length > MAX_LOG_EVENTS) {
    inMemoryLogs = inMemoryLogs.slice(-MAX_LOG_EVENTS);
  }

  // Console output with clear tag for Logcat / Debugger
  const consolePrefix = `[OAuthDiagnostics][${level.toUpperCase()}][${event.formattedTime}] ${step}`;
  if (level === 'error') {
    console.error(consolePrefix, detailStr || '');
  } else if (level === 'ok') {
    console.log(consolePrefix, detailStr || '');
  } else {
    console.log(consolePrefix, detailStr || '');
  }

  persistLogs();
  notifySubscribers();

  return event;
}

/**
 * Get a copy of all current OAuth diagnostic logs (chronological).
 */
export function getOauthLogs(): OAuthLogEvent[] {
  hydrateFromStorage();
  return [...inMemoryLogs];
}

/**
 * Clear all current OAuth logs.
 */
export function clearOauthLogs(): void {
  inMemoryLogs = [];
  persistLogs();
  notifySubscribers();
}

/**
 * Subscribe to OAuth log updates. Returns an unsubscribe function.
 */
export function subscribeOauthLogs(listener: LogSubscriber): () => void {
  hydrateFromStorage();
  subscribers.add(listener);
  // Initial callback with current logs
  try {
    listener([...inMemoryLogs]);
  } catch {}
  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Format OAuth logs as a readable plaintext log for clipboard / export.
 */
export function formatOauthLogsText(): string {
  hydrateFromStorage();
  if (inMemoryLogs.length === 0) {
    return '--- StrongerN OAuth Diagnostics: No logs recorded ---';
  }
  const lines = [
    '=== StrongerN OAuth Diagnostics Log ===',
    `Exported: ${new Date().toISOString()}`,
    `Total Events: ${inMemoryLogs.length}`,
    '----------------------------------------',
  ];
  inMemoryLogs.forEach((e) => {
    const tag = e.level === 'ok' ? '[OK]   ' : e.level === 'error' ? '[ERROR]' : '[INFO] ';
    lines.push(`${e.formattedTime} ${tag} ${e.step}${e.detail ? ` -> ${e.detail}` : ''}`);
  });
  lines.push('========================================');
  return lines.join('\n');
}

/**
 * Copy formatted logs to system clipboard.
 */
export function copyOauthLogsToClipboard(): boolean {
  try {
    const text = formatOauthLogsText();
    Clipboard.setString(text);
    return true;
  } catch (err) {
    console.warn('[OAuthDiagnostics] Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Known package identifiers for Google Chrome on Android in priority order.
 */
export const CHROME_PACKAGE_NAMES = [
  'com.android.chrome',
  'com.chrome.beta',
  'com.chrome.dev',
  'com.chrome.canary',
  'com.google.android.apps.chrome',
];

/**
 * Determines the best Custom Tabs browser package on Android.
 * Prioritizes Google Chrome to guarantee reliable deep-link and custom-scheme OAuth redirects,
 * preventing privacy browsers like Brave from swallowing the redirect callback.
 */
export async function getPreferredOAuthBrowserPackage(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;

  try {
    if (typeof WebBrowser.getCustomTabsSupportingBrowsersAsync === 'function') {
      const result = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
      const allAvailable = [
        ...(result.browserPackages || []),
        ...(result.servicePackages || []),
        result.defaultBrowserPackage,
        result.preferredBrowserPackage,
      ].filter(Boolean) as string[];

      const matchedChrome = CHROME_PACKAGE_NAMES.find((pkg) => allAvailable.includes(pkg));
      if (matchedChrome) {
        return matchedChrome;
      }

      // If Chrome is not detected in supported browsers list, check preferred / default
      if (result.preferredBrowserPackage) return result.preferredBrowserPackage;
      if (result.defaultBrowserPackage) return result.defaultBrowserPackage;
      if (result.browserPackages && result.browserPackages.length > 0) return result.browserPackages[0];
    }
  } catch (err) {
    console.warn('[OAuthDiagnostics] Could not query custom tabs browsers:', err);
  }

  // Best-effort Android default: Chrome
  return 'com.android.chrome';
}

/**
 * Warms up the selected browser for instant Custom Tab presentation.
 */
export async function warmUpOAuthBrowser(browserPackage?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if (typeof WebBrowser.warmUpAsync === 'function') {
      await WebBrowser.warmUpAsync(browserPackage);
    }
  } catch {}
}

