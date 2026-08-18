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
  getPersistenceMeta,
  initHistoryRepository,
  loadAllSessions,
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
  console.log('[Bootstrap] Initializing adapters...');
  const mmkvReady = initMMKVAdapter();
  const historyReady = await initHistoryRepository();
  console.log('[Bootstrap] Adapters ready - MMKV:', mmkvReady, 'History DB:', historyReady);
  const now = Date.now();

  let sessions: WorkoutSessionV2[] = [];
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
      console.log('[Bootstrap] Previous migration meta:', previousRaw);
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
        // FAST-PATH HYDRATION: Relational SQLite V2 is verified and marked ready.
        // Bypass legacy JSON stringify & DJB2 character checksumming routine on cold start.
        sessions = await loadAllSessions();
        // Self-healing: If legacy source has more sessions than SQLite V2 (e.g. from an earlier partial migration)
        const legacyAppValidation = validateLegacyAppDataV1(legacyAppRaw ?? {});
        const legacyApp: LegacyAppDataV1 = legacyAppValidation.success ? legacyAppValidation.data : {};
        const legacySessions = Array.isArray(legacyApp.sessionsList) ? legacyApp.sessionsList : [];
        if (legacySessions.length > sessions.length) {
          console.warn(`[Bootstrap] Self-healing migration: Legacy has ${legacySessions.length} sessions vs SQLite ${sessions.length}. Migrating missing sessions...`);
          for (let index = 0; index < legacySessions.length; index += 1) {
            await upsertSession(legacySessionToV2(legacySessions[index], index));
          }
          sessions = await loadAllSessions();
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

        for (let index = 0; index < legacySessions.length; index += 1) {
          await upsertSession(legacySessionToV2(legacySessions[index], index));
        }

        sessions = await loadAllSessions();
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
  return { mmkvReady, historyReady, activeDraft, sessions, settings, migration };
}
