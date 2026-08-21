// src/storage/instantCache.ts
// Synchronous Frame 0 MMKV cache for instant app startup.
// Stores auth state, user profile, templates, custom exercises, metric summaries,
// recent sessions snapshot, and precomputed profile widgets.

import { initMMKVAdapter, mmkvStorageAdapter } from './adapters/mmkvAdapter';
import { STORAGE_KEYS } from './keys';
import { AuthState } from '../utils/authStore';

export interface InstantAppData {
  user: {
    name: string;
    totalWorkouts: number;
    isPro: boolean;
    avatarUri?: string;
  };
  templatesList: any[];
  exercisesList: any[];
  primaryMetricsList: any[];
  bodyPartMetricsList: any[];
  googleUser?: {
    email: string;
    name: string;
    avatarUri?: string;
    fileId?: string;
  } | null;
  lastSynced?: string | null;
  foldersList: string[];
  activeProgramId?: string | null;
  programStartDate?: string | null;
}

export interface InstantProfileSummaries {
  dynamicWeeklyChartData?: { weekLabel: string; count: number }[];
  weeklyMuscleSets?: Record<string, number>;
}

export interface ExerciseLifetimeDetail {
  sets: number;
  volumeKg: number;
  lastPerformedMs: number;
}

export interface LifetimeStatsSummary {
  totalCompletedSets: number;
  totalVolumeKg: number;
  muscleSets: Record<string, number>;
  muscleVolumeKg?: Record<string, number>;
  exerciseSets: Record<string, number | ExerciseLifetimeDetail>;
  lastCalculatedMs: number;
}

export function safeMmkvGet(key: string): string | null {
  try {
    initMMKVAdapter();
    if (!mmkvStorageAdapter.isAvailable()) return null;
    return mmkvStorageAdapter.getString(key);
  } catch {
    return null;
  }
}

export function safeMmkvSet(key: string, value: string): boolean {
  try {
    initMMKVAdapter();
    if (!mmkvStorageAdapter.isAvailable()) return false;
    return mmkvStorageAdapter.setString(key, value);
  } catch {
    return false;
  }
}

export function safeMmkvRemove(key: string): boolean {
  try {
    initMMKVAdapter();
    if (!mmkvStorageAdapter.isAvailable()) return false;
    return mmkvStorageAdapter.removeItem(key);
  } catch {
    return false;
  }
}

/**
 * Synchronously retrieves cached AuthState from MMKV on Frame 0.
 */
export function getCachedAuthState(): AuthState | null {
  const raw = safeMmkvGet(STORAGE_KEYS.INSTANT_AUTH_CACHE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.hasCompletedOnboarding === 'boolean') {
      return parsed as AuthState;
    }
  } catch {}
  return null;
}

/**
 * Synchronously updates cached AuthState in MMKV.
 */
export function setCachedAuthState(state: AuthState): void {
  safeMmkvSet(STORAGE_KEYS.INSTANT_AUTH_CACHE, JSON.stringify(state));
}

/**
 * Synchronously retrieves cached core AppData from MMKV on Frame 0.
 */
export function getCachedAppData(): InstantAppData | null {
  const raw = safeMmkvGet(STORAGE_KEYS.INSTANT_APP_DATA_CACHE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.user) {
      // Re-hydrate Date objects in templates if any
      if (Array.isArray(parsed.templatesList)) {
        parsed.templatesList = parsed.templatesList.map((t: any) => ({
          ...t,
          lastUsed: t.lastUsed ? new Date(t.lastUsed) : undefined,
        }));
      }
      return parsed as InstantAppData;
    }
  } catch {}
  return null;
}

/**
 * Synchronously updates cached core AppData in MMKV.
 */
export function setCachedAppData(data: InstantAppData): void {
  safeMmkvSet(STORAGE_KEYS.INSTANT_APP_DATA_CACHE, JSON.stringify(data));
  if (data.user && typeof data.user.totalWorkouts === 'number') {
    setCachedTotalSessionsCount(data.user.totalWorkouts);
  }
}

/**
 * Synchronously retrieves cached recent sessions (up to 20) on Frame 0.
 */
export function getCachedRecentSessions(): any[] | null {
  const raw = safeMmkvGet(STORAGE_KEYS.INSTANT_RECENT_SESSIONS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((s: any) => ({
        ...s,
        datetime: s.datetime ? new Date(s.datetime) : new Date(),
      }));
    }
  } catch {}
  return null;
}

/**
 * Synchronously retrieves cached total sessions count on Frame 0.
 */
export function getCachedTotalSessionsCount(): number | null {
  const raw = safeMmkvGet(STORAGE_KEYS.INSTANT_TOTAL_SESSIONS_COUNT);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Synchronously saves cached total sessions count in MMKV.
 */
export function setCachedTotalSessionsCount(count: number): void {
  try {
    safeMmkvSet(STORAGE_KEYS.INSTANT_TOTAL_SESSIONS_COUNT, String(Math.max(0, Math.round(count))));
  } catch {}
}

/**
 * Synchronously saves snapshot of recent sessions in MMKV.
 * Optionally persists total session count to ensure Profile/Home counter is correct on Frame 0.
 */
export function setCachedRecentSessions(sessions: any[], totalCount?: number): void {
  try {
    const list = sessions || [];
    const snapshot = list.slice(0, 20);
    safeMmkvSet(STORAGE_KEYS.INSTANT_RECENT_SESSIONS, JSON.stringify(snapshot));
    const count = typeof totalCount === 'number' ? totalCount : list.length;
    setCachedTotalSessionsCount(count);
  } catch {}
}

/**
 * Synchronously retrieves precomputed profile summaries (charts, muscle sets) on Frame 0.
 */
export function getCachedProfileSummaries(): InstantProfileSummaries | null {
  const raw = safeMmkvGet(STORAGE_KEYS.INSTANT_PROFILE_SUMMARIES);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InstantProfileSummaries;
  } catch {
    return null;
  }
}

/**
 * Synchronously saves precomputed profile summaries in MMKV.
 */
export function setCachedProfileSummaries(summaries: InstantProfileSummaries): void {
  safeMmkvSet(STORAGE_KEYS.INSTANT_PROFILE_SUMMARIES, JSON.stringify(summaries));
}

/**
 * Synchronously retrieves precomputed lifetime stats (completed sets, muscle group breakdown) on Frame 0.
 */
export function getCachedLifetimeStats(): LifetimeStatsSummary | null {
  const raw = safeMmkvGet(STORAGE_KEYS.INSTANT_LIFETIME_STATS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LifetimeStatsSummary;
  } catch {
    return null;
  }
}

/**
 * Synchronously saves precomputed lifetime stats in MMKV.
 */
export function setCachedLifetimeStats(stats: LifetimeStatsSummary): void {
  safeMmkvSet(STORAGE_KEYS.INSTANT_LIFETIME_STATS, JSON.stringify(stats));
}

export function getCachedLifetimeSets(): LifetimeStatsSummary | null {
  return getCachedLifetimeStats();
}

export function setCachedLifetimeSets(stats: LifetimeStatsSummary): void {
  setCachedLifetimeStats(stats);
}

/**
 * Synchronously retrieves last cloud backup hash.
 */
export function getCachedBackupHash(): string | null {
  return safeMmkvGet(STORAGE_KEYS.BACKUP_HASH);
}

/**
 * Synchronously sets last cloud backup hash.
 */
export function setCachedBackupHash(hash: string): void {
  safeMmkvSet(STORAGE_KEYS.BACKUP_HASH, hash);
}

/**
 * Clears all instant cache keys (used during full app data reset).
 */
export function clearInstantCache(): void {
  safeMmkvRemove(STORAGE_KEYS.INSTANT_AUTH_CACHE);
  safeMmkvRemove(STORAGE_KEYS.INSTANT_APP_DATA_CACHE);
  safeMmkvRemove(STORAGE_KEYS.INSTANT_RECENT_SESSIONS);
  safeMmkvRemove(STORAGE_KEYS.INSTANT_TOTAL_SESSIONS_COUNT);
  safeMmkvRemove(STORAGE_KEYS.INSTANT_PROFILE_SUMMARIES);
  safeMmkvRemove(STORAGE_KEYS.INSTANT_LIFETIME_STATS);
  safeMmkvRemove(STORAGE_KEYS.INSTANT_LIFETIME_SETS);
  safeMmkvRemove(STORAGE_KEYS.BACKUP_HASH);
}
