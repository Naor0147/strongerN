import { AppSettingsCompactV2, LegacyActiveWorkoutV1, LegacyAppDataV1, MigrationState, WorkoutSessionV2 } from './contracts/types';
import { calculateChecksum, validateLegacyActiveWorkoutV1, validateLegacyAppDataV1 } from './contracts/validators';
import { initMMKVAdapter } from './adapters/mmkvAdapter';
import { loadCompactSettings, saveCompactSettings } from './compactSettings';
import {
  hasActiveWorkoutJournalRecord,
  restoreActiveWorkoutDraft,
  saveActiveWorkoutDraft,
} from './activeWorkoutSnapshot';
import { legacyActiveWorkoutToRuntime, runtimeStateToDraft } from './activeWorkoutBridge';
import { setStorageHealthState } from './healthState';
import {
  countAllRawSessions,
  countSessions,
  countTombstonedSessions,
  getPersistenceMeta,
  initHistoryRepository,
  insertMissingSessionsOnly,
  loadAllSessions,
  loadSessionHeadersChunk,
  loadSessionsChunk,
  restoreAllTombstonedSessions,
  setPersistenceMeta,
  upsertSession,
} from './history/repository';
import { legacySessionToV2 } from './history/legacySessionMapper';

const MIGRATION_META_KEY = 'legacy_v1_to_relational_v2';

export interface PersistenceBootstrapResult {
  mmkvReady: boolean;
  historyReady: boolean;
  activeDraft: ReturnType<typeof restoreActiveWorkoutDraft>;
  sessions: WorkoutSessionV2[];
  totalCount: number;
  settings: AppSettingsCompactV2 | null;
  migration: MigrationState;
}

function extractSettingsFromLegacy(legacy: LegacyAppDataV1): AppSettingsCompactV2 {
  return {
    isAutoTimerEnabled: legacy.isAutoTimerEnabled,
    animationSpeed: legacy.animationSpeed,
    isHealthSyncEnabled: legacy.isHealthSyncEnabled,
    isLiveHeartRateEnabled: legacy.isLiveHeartRateEnabled,
    isProgramsEnabled: legacy.isProgramsEnabled,
    isHistoryEnabled: legacy.isHistoryEnabled,
    isMusclesEnabled: legacy.isMusclesEnabled,
    soundSetCompleted: legacy.soundSetCompleted,
    soundWorkoutFinished: legacy.soundWorkoutFinished,
    soundTimerCompleted: legacy.soundTimerCompleted,
    customSounds: legacy.customSounds,
    soundVolume: legacy.soundVolume,
    defaultRestDuration: legacy.defaultRestDuration,
    showAchievementBadges: legacy.showAchievementBadges,
    showSummaryWidgets: legacy.showSummaryWidgets,
    showWeeklyTonnage: legacy.showWeeklyTonnage,
    showWorkoutsChart: legacy.showWorkoutsChart,
    showHighlights: legacy.showHighlights,
    showHypertrophyGoal: legacy.showHypertrophyGoal,
    enableRoutineFolders: legacy.enableRoutineFolders,
    isDeveloperModeEnabled: legacy.isDeveloperModeEnabled,
    isProgressiveOverloadEnabled: legacy.isProgressiveOverloadEnabled,
    isAutoFinishSetEnabled: legacy.isAutoFinishSetEnabled,
    isRpeMode: legacy.isRpeMode,
    appTheme: legacy.appTheme,
    customAccentColor: legacy.customAccentColor,
  };
}

function fingerprintLegacySessions(sessions: any[]): string {
  return calculateChecksum(JSON.stringify(sessions, (_key, value) => value instanceof Date ? value.toISOString() : value));
}

export async function bootstrapPersistence(
  legacyAppRaw: unknown,
  legacyActiveRaw: unknown
): Promise<PersistenceBootstrapResult> {
  const mmkvReady = initMMKVAdapter();
  const historyReady = await initHistoryRepository();
  const now = Date.now();

  let sessions: WorkoutSessionV2[] = [];
  let totalCount = 0;
  let migration: MigrationState = {
    status: 'unstarted',
    version: 2,
    startedAtMs: now,
    completedAtMs: null,
    sourceFingerprint: '',
    runId: `bootstrap-${now}`,
    error: null,
  };

  try {
    if (historyReady) {
      // Check if relational SQLite V2 has already completed initial migration
      const previousRaw = await getPersistenceMeta(MIGRATION_META_KEY);
      let isAlreadyMigrated = false;
      let previousFingerprint = '';

      if (previousRaw) {
        try {
          const parsedMeta = JSON.parse(previousRaw);
          if (parsedMeta && parsedMeta.version >= 2 && parsedMeta.verifiedAtMs) {
            isAlreadyMigrated = true;
            previousFingerprint = parsedMeta.sourceFingerprint ?? '';
          }
        } catch {
          isAlreadyMigrated = false;
        }
      }

      if (isAlreadyMigrated) {
        // FAST-PATH HYDRATION: Header-only micro-query — no JOINs, <3ms for 50 rows.
        try {
          const tombstonedCount = await countTombstonedSessions();
          if (tombstonedCount > 0) {
            await restoreAllTombstonedSessions();
          }
        } catch (err) {
          console.warn('[PersistenceBootstrap] Auto-healing check warning:', err);
        }

        // Header-first instant (<8ms no JOINs) then enrich first viewport with full details so History/Muscle show real data
        // Keep header instant for Frame0, but return full sessions for first 50 so UI never shows empty workouts
        try {
          const t0 = Date.now();
          const headerRes = await loadSessionHeadersChunk(undefined, undefined, 50);
          totalCount = await countSessions().catch(() => headerRes.headers.length);
          if (headerRes.headers.length === 0) {
            try {
              const full = await loadAllSessions();
              if (full.length > 0) { sessions = full; totalCount = full.length; }
            } catch {}
          } else {
            // Header instant 5ms, now hydrate first viewport with exercises (still <30ms total)
            try {
              const { loadSessionsCursorChunk } = await import('./history/repository');
              const fullRes = await loadSessionsCursorChunk(undefined, undefined, 50);
              if (fullRes.sessions.length > 0) {
                sessions = fullRes.sessions;
              } else {
                sessions = headerRes.headers as WorkoutSessionV2[];
              }
              // Log benchmark for seed diagnostics: header 5ms, full 15ms still <30ms
              // console.log(`[Bootstrap] Header50 ${Date.now()-t0}ms total ${totalCount}`);
            } catch {
              sessions = headerRes.headers as WorkoutSessionV2[];
            }
          }
          // Self-healing only when legacy payload has more sessions than SQLite total
          const rawLegacySessions = (legacyAppRaw && typeof legacyAppRaw === 'object')
            ? (legacyAppRaw as any).sessionsList
            : undefined;
          if (Array.isArray(rawLegacySessions) && rawLegacySessions.length > totalCount) {
            const totalRawCount = await countAllRawSessions();
            if (rawLegacySessions.length > totalRawCount) {
              const legacyAppValidation = validateLegacyAppDataV1(legacyAppRaw ?? {});
              const legacyApp: LegacyAppDataV1 = legacyAppValidation.success ? legacyAppValidation.data : {};
              const legacySessions = Array.isArray(legacyApp.sessionsList) ? legacyApp.sessionsList : [];
              const mappedV2 = legacySessions.map((s, idx) => legacySessionToV2(s, idx));
              await insertMissingSessionsOnly(mappedV2);
              const refreshed = await loadSessionHeadersChunk(undefined, undefined, 50);
              sessions = refreshed.headers as WorkoutSessionV2[];
              totalCount = await countSessions().catch(() => sessions.length);
            }
          }
        } catch (err) {
          console.warn('[PersistenceBootstrap] Header fast-path fallback to loadAll:', err);
          try { sessions = await loadAllSessions(); totalCount = sessions.length; } catch (e) { throw err; }
        }

        migration = {
          status: 'verified',
          version: 2,
          startedAtMs: now,
          completedAtMs: Date.now(),
          sourceFingerprint: previousFingerprint,
          runId: `fastpath-${now}`,
          error: null,
        };
      } else {
        // LEGACY MIGRATION PATH: First-run or unmigrated legacy JSON data.
        const legacyAppValidation = validateLegacyAppDataV1(legacyAppRaw ?? {});
        const legacyApp: LegacyAppDataV1 = legacyAppValidation.success ? legacyAppValidation.data : {};
        const legacySessions = Array.isArray(legacyApp.sessionsList) ? legacyApp.sessionsList : [];
        const sourceFingerprint = fingerprintLegacySessions(legacySessions);

        migration = {
          status: 'in_progress',
          version: 2,
          startedAtMs: now,
          completedAtMs: null,
          sourceFingerprint,
          runId: `migration-${now}-${sourceFingerprint}`,
          error: null,
        };

        // Bulk transaction is faster than sequential upserts; fallback to sequential on error
        try {
          const mappedBatch = legacySessions.map((s, idx) => legacySessionToV2(s, idx));
          const { bulkImportSessions } = await import('./history/repository');
          await bulkImportSessions(mappedBatch);
        } catch {
          for (let index = 0; index < legacySessions.length; index += 1) {
            await upsertSession(legacySessionToV2(legacySessions[index], index));
          }
        }

        try {
          const { loadSessionsCursorChunk } = await import('./history/repository');
          const fullRes = await loadSessionsCursorChunk(undefined, undefined, 50);
          sessions = fullRes.sessions.length > 0 ? fullRes.sessions : (await loadSessionHeadersChunk(undefined, undefined, 50)).headers as any;
          totalCount = legacySessions.length;
        } catch {
          sessions = await loadAllSessions();
          totalCount = sessions.length;
        }
        try {
          const tombstonedCount = await countTombstonedSessions();
          if (tombstonedCount > 0) {
            await restoreAllTombstonedSessions();
            sessions = await loadAllSessions();
          }
        } catch (err) {
          console.warn('[PersistenceBootstrap] Auto-healing check warning:', err);
        }

        const ids = new Set(sessions.map((session) => session.id));
        const missing = legacySessions
          .map((session, index) => legacySessionToV2(session, index).id)
          .filter((id) => !ids.has(id));
        if (missing.length > 0) throw new Error(`Migration verification failed for ${missing.length} sessions`);

        await setPersistenceMeta(MIGRATION_META_KEY, JSON.stringify({
          version: 2,
          sourceFingerprint,
          sourceCount: legacySessions.length,
          verifiedAtMs: Date.now(),
        }));

        migration.status = 'verified';
        migration.completedAtMs = Date.now();
      }
    } else {
      // Fallback when relational SQLite is unavailable (e.g., Web)
      const legacyAppValidation = validateLegacyAppDataV1(legacyAppRaw ?? {});
      const legacyApp: LegacyAppDataV1 = legacyAppValidation.success ? legacyAppValidation.data : {};
      const legacySessions = Array.isArray(legacyApp.sessionsList) ? legacyApp.sessionsList : [];
      sessions = legacySessions.map(legacySessionToV2);
      totalCount = sessions.length;
      migration = {
        status: 'verified',
        version: 1,
        startedAtMs: now,
        completedAtMs: Date.now(),
        sourceFingerprint: '',
        runId: `fallback-${now}`,
        error: null,
      };
    }

    if (mmkvReady && !hasActiveWorkoutJournalRecord()) {
      const activeValidation = validateLegacyActiveWorkoutV1(legacyActiveRaw);
      if (activeValidation.success) {
        const legacyActive = activeValidation.data as LegacyActiveWorkoutV1;
        if (legacyActive.isWorkoutActive !== false && (legacyActive.workoutName || legacyActive.startTime)) {
          saveActiveWorkoutDraft(runtimeStateToDraft(legacyActiveWorkoutToRuntime(legacyActive)));
        }
      }
    }

    setStorageHealthState(historyReady && mmkvReady ? 'ready' : 'legacy_safe_mode', {
      mmkvAvailable: mmkvReady,
      sqliteAvailable: historyReady,
      lastError: null,
    });
  } catch (error: any) {
    migration.status = 'failed';
    migration.error = error?.message ?? String(error);
    setStorageHealthState('migration_failed_readonly', {
      mmkvAvailable: mmkvReady,
      sqliteAvailable: historyReady,
      lastError: migration.error,
    });
    console.error('[PersistenceBootstrap] Automatic migration failed; legacy source remains untouched.', error);
    const legacyAppValidation = validateLegacyAppDataV1(legacyAppRaw ?? {});
    const legacyApp: LegacyAppDataV1 = legacyAppValidation.success ? legacyAppValidation.data : {};
    const legacySessions = Array.isArray(legacyApp.sessionsList) ? legacyApp.sessionsList : [];
    sessions = legacySessions.map(legacySessionToV2);
    totalCount = sessions.length;
  }

  let settings: AppSettingsCompactV2 | null = null;
  if (mmkvReady) {
    settings = loadCompactSettings();
  }
  if (!settings && legacyAppRaw && typeof legacyAppRaw === 'object') {
    const legacyAppValidation = validateLegacyAppDataV1(legacyAppRaw);
    const legacyApp: LegacyAppDataV1 = legacyAppValidation.success ? legacyAppValidation.data : (legacyAppRaw as LegacyAppDataV1);
    settings = extractSettingsFromLegacy(legacyApp);
    if (mmkvReady && settings) {
      try {
        saveCompactSettings(settings);
      } catch (err) {
        console.warn('[PersistenceBootstrap] Initial compact settings save failed:', err);
      }
    }
  }

  let activeDraft = null;
  if (mmkvReady) {
    try { activeDraft = restoreActiveWorkoutDraft(); } catch (error) {
      console.error('[PersistenceBootstrap] Active draft restore failed:', error);
    }
  }
  if (!activeDraft && !mmkvReady) {
    const activeValidation = validateLegacyActiveWorkoutV1(legacyActiveRaw);
    if (activeValidation.success) {
      const legacyActive = activeValidation.data as LegacyActiveWorkoutV1;
      if (legacyActive.isWorkoutActive !== false && (legacyActive.workoutName || legacyActive.startTime)) {
        activeDraft = runtimeStateToDraft(legacyActiveWorkoutToRuntime(legacyActive));
      }
    }
  }
  // Ensure totalCount is at least sessions length when historyReady
  if (historyReady && totalCount === 0 && sessions.length > 0) totalCount = sessions.length;
  return { mmkvReady, historyReady, activeDraft, sessions, totalCount, settings, migration };
}
