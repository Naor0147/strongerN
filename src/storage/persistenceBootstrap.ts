import { LegacyActiveWorkoutV1, LegacyAppDataV1, MigrationState, WorkoutSessionV2 } from './contracts/types';
import { calculateChecksum, validateLegacyActiveWorkoutV1, validateLegacyAppDataV1 } from './contracts/validators';
import { initMMKVAdapter } from './adapters/mmkvAdapter';
import {
  hasActiveWorkoutJournalRecord,
  restoreActiveWorkoutDraft,
  saveActiveWorkoutDraft,
} from './activeWorkoutSnapshot';
import { legacyActiveWorkoutToRuntime, runtimeStateToDraft } from './activeWorkoutBridge';
import { setStorageHealthState } from './healthState';
import {
  countSessions,
  getPersistenceMeta,
  initHistoryRepository,
  listSessions,
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
  migration: MigrationState;
}

function fingerprintLegacySessions(sessions: any[]): string {
  return calculateChecksum(JSON.stringify(sessions, (_key, value) => value instanceof Date ? value.toISOString() : value));
}

async function loadAllSessions(): Promise<WorkoutSessionV2[]> {
  const count = await countSessions();
  const output: WorkoutSessionV2[] = [];
  for (let offset = 0; offset < count; offset += 250) {
    output.push(...await listSessions(250, offset));
  }
  return output;
}

export async function bootstrapPersistence(
  legacyAppRaw: unknown,
  legacyActiveRaw: unknown
): Promise<PersistenceBootstrapResult> {
  const mmkvReady = initMMKVAdapter();
  const historyReady = await initHistoryRepository();
  const legacyAppValidation = validateLegacyAppDataV1(legacyAppRaw ?? {});
  const legacyApp: LegacyAppDataV1 = legacyAppValidation.success ? legacyAppValidation.data : {};
  const legacySessions = Array.isArray(legacyApp.sessionsList) ? legacyApp.sessionsList : [];
  const sourceFingerprint = fingerprintLegacySessions(legacySessions);
  const now = Date.now();
  const migration: MigrationState = {
    status: 'in_progress',
    version: 2,
    startedAtMs: now,
    completedAtMs: null,
    sourceFingerprint,
    runId: `migration-${now}-${sourceFingerprint}`,
    error: null,
  };

  let sessions: WorkoutSessionV2[] = [];
  try {
    if (historyReady) {
      const previousRaw = await getPersistenceMeta(MIGRATION_META_KEY);
      let previousFingerprint = '';
      try { previousFingerprint = JSON.parse(previousRaw ?? '{}').sourceFingerprint ?? ''; } catch {}
      if (previousFingerprint !== sourceFingerprint) {
        for (let index = 0; index < legacySessions.length; index += 1) {
          await upsertSession(legacySessionToV2(legacySessions[index], index));
        }
        const ids = new Set((await loadAllSessions()).map((session) => session.id));
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
      }
      sessions = await loadAllSessions();
    } else {
      sessions = legacySessions.map(legacySessionToV2);
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

    migration.status = 'verified';
    migration.completedAtMs = Date.now();
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
    sessions = legacySessions.map(legacySessionToV2);
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
  return { mmkvReady, historyReady, activeDraft, sessions, migration };
}
