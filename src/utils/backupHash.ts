/**
 * backupHash.ts
 *
 * Deterministic, fast content fingerprinting for cloud backup payload.
 * Prevents redundant cloud sync uploads when data has not changed.
 */

export interface BackupPayloadSnapshot {
  userName?: string;
  totalWorkouts?: number;
  templatesCount?: number;
  templatesFingerprint?: string;
  customExercisesCount?: number;
  sessionsCount?: number;
  newestSessionId?: string;
  newestSessionTime?: number;
  oldestSessionId?: string;
  oldestSessionTime?: number;
}

export function computeBackupFingerprint(payload: {
  user?: { name?: string; totalWorkouts?: number; isPro?: boolean };
  templatesList?: any[];
  exercisesList?: any[];
  sessionsList?: any[];
  primaryMetricsList?: any[];
  bodyPartMetricsList?: any[];
}): string {
  const userStr = `${payload.user?.name ?? ''}:${payload.user?.totalWorkouts ?? 0}:${payload.user?.isPro ? 1 : 0}`;
  
  const templates = payload.templatesList || [];
  let templateHash = 0;
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const str = `${t?.id ?? ''}-${t?.name ?? ''}-${t?.lastUsed ? new Date(t.lastUsed).getTime() : 0}`;
    for (let j = 0; j < str.length; j++) {
      templateHash = ((templateHash << 5) - templateHash + str.charCodeAt(j)) | 0;
    }
  }

  const customExercises = (payload.exercisesList || []).filter((e: any) => e?.isCustom);
  const customExCount = customExercises.length;

  const sessions = payload.sessionsList || [];
  const sessionsCount = sessions.length;
  let newestId = '';
  let newestTime = 0;
  let oldestId = '';
  let oldestTime = 0;

  if (sessions.length > 0) {
    const first = sessions[0];
    newestId = String(first?.id ?? '');
    newestTime = first?.datetime ? new Date(first.datetime).getTime() : 0;

    const last = sessions[sessions.length - 1];
    oldestId = String(last?.id ?? '');
    oldestTime = last?.datetime ? new Date(last.datetime).getTime() : 0;
  }

  const metricsCount = (payload.primaryMetricsList?.length || 0) + (payload.bodyPartMetricsList?.length || 0);

  const raw = `${userStr}|tpl:${templates.length}:${templateHash}|custEx:${customExCount}|sess:${sessionsCount}:${newestId}:${newestTime}:${oldestId}:${oldestTime}|met:${metricsCount}`;

  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}
