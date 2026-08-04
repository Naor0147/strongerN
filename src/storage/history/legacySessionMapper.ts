import { WorkoutSession } from '../../data/mockData';
import {
  SessionExerciseV2,
  SetLogV2,
  WorkoutSessionV2,
} from '../contracts/types';
import {
  calculateChecksum,
  milliKgToWeightString,
  normalizeSetCategory,
  parseReps,
  parseRpeTenths,
  weightToMilliKg,
} from '../contracts/validators';

export function normalizeLookupKey(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}
function nonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toTimestamp(value: unknown, fallback: number): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? Math.max(0, Math.trunc(ms)) : fallback;
  }
  const numeric = typeof value === 'number' ? value : Number.NaN;
  if (Number.isFinite(numeric)) return Math.max(0, Math.trunc(numeric));
  const parsed = new Date(String(value ?? '')).getTime();
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function stableId(prefix: string, seed: string): string {
  return `${prefix}-${calculateChecksum(seed)}`;
}

function legacySetsForExercise(exercise: any): any[] {
  if (Array.isArray(exercise?.setsDetails)) return exercise.setsDetails;
  if (Array.isArray(exercise?.sets)) return exercise.sets;
  const count = Math.max(0, Math.trunc(nonNegativeNumber(exercise?.sets)));
  return Array.from({ length: count }, () => ({
    weight: exercise?.bestWeight ?? 0,
    reps: exercise?.bestReps ?? 0,
    completed: true,
    category: 'S',
  }));
}

export function legacySessionToV2(raw: any, sourceIndex = 0): WorkoutSessionV2 {
  const fallbackStart = Math.max(0, Date.now() - sourceIndex);
  const startedAtMs = toTimestamp(raw?.datetime ?? raw?.startedAtMs, fallbackStart);
  const durationSec = Math.max(0, Math.round(nonNegativeNumber(raw?.durationMinutes, nonNegativeNumber(raw?.durationSec) / 60) * 60));
  const sessionId = typeof raw?.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : stableId('legacy-session', `${startedAtMs}|${raw?.title ?? ''}|${sourceIndex}`);
  const title = String(raw?.title ?? 'Workout').trim() || 'Workout';

  const exercises: SessionExerciseV2[] = (Array.isArray(raw?.exercises) ? raw.exercises : [])
    .filter((exercise: any) => exercise && typeof exercise === 'object' && String(exercise.name ?? '').trim())
    .map((exercise: any, exercisePosition: number) => {
      const nameSnapshot = String(exercise.name).trim();
      const exerciseRowId = stableId('session-exercise', `${sessionId}|${exercisePosition}|${normalizeLookupKey(nameSnapshot)}`);
      const sets: SetLogV2[] = legacySetsForExercise(exercise).map((set: any, setPosition: number) => {
        const isUnilateral = Boolean(set?.isUnilateral);
        return {
          id: stableId('set-log', `${exerciseRowId}|${setPosition}`),
          position: setPosition,
          category: normalizeSetCategory(set?.category),
          completed: typeof set?.completed === 'boolean' ? set.completed : true,
          weightMilliKg: weightToMilliKg(set?.weight ?? set?.weightKg ?? exercise?.bestWeight ?? 0),
          reps: parseReps(set?.reps ?? exercise?.bestReps ?? 0),
          rpeTenths: parseRpeTenths(set?.rpe),
          isUnilateral,
          leftWeightMilliKg: isUnilateral ? weightToMilliKg(set?.leftWeight ?? set?.weight ?? 0) : null,
          leftReps: isUnilateral ? parseReps(set?.leftReps ?? set?.reps ?? 0) : null,
          rightWeightMilliKg: isUnilateral ? weightToMilliKg(set?.rightWeight ?? set?.weight ?? 0) : null,
          rightReps: isUnilateral ? parseReps(set?.rightReps ?? set?.reps ?? 0) : null,
        };
      });
      return {
        id: exerciseRowId,
        sessionId,
        exerciseId: typeof exercise?.exerciseId === 'string' ? exercise.exerciseId : null,
        nameSnapshot,
        nameNorm: normalizeLookupKey(nameSnapshot),
        variationKey: normalizeLookupKey(exercise?.variation),
        position: exercisePosition,
        supersetGroupId: typeof exercise?.superSetGroupId === 'string' ? exercise.superSetGroupId : null,
        note: typeof exercise?.note === 'string' ? exercise.note : null,
        sets,
      };
    });

  const totalVolumeMilliKg = Math.round(nonNegativeNumber(raw?.totalVolumeKg) * 1000);
  return {
    id: sessionId,
    title,
    titleNorm: normalizeLookupKey(title),
    startedAtMs,
    endedAtMs: startedAtMs + durationSec * 1000,
    durationSec,
    comment: typeof raw?.comment === 'string' ? raw.comment : null,
    totalVolumeMilliKg,
    prs: Math.max(0, Math.trunc(nonNegativeNumber(raw?.prs))),
    createdAtMs: toTimestamp(raw?.createdAtMs, startedAtMs),
    updatedAtMs: toTimestamp(raw?.updatedAtMs, Math.max(startedAtMs, Date.now())),
    revision: Math.max(1, Math.trunc(nonNegativeNumber(raw?.revision, 1))),
    deletedAtMs: null,
    exercises,
  };
}

function milliKgToNumber(value: number | null): number {
  const normalized = milliKgToWeightString(value);
  return normalized ? Number(normalized) : 0;
}

export function sessionV2ToLegacy(session: WorkoutSessionV2): WorkoutSession {
  return {
    id: session.id,
    title: session.title,
    datetime: new Date(session.startedAtMs),
    comment: session.comment ?? undefined,
    durationMinutes: Math.max(0, Math.round(session.durationSec / 60)),
    totalVolumeKg: session.totalVolumeMilliKg / 1000,
    prs: session.prs,
    exercises: session.exercises.map((exercise) => {
      const completedSets = exercise.sets.filter((set) => set.completed);
      return {
        name: exercise.nameSnapshot,
        variation: exercise.variationKey || undefined,
        sets: completedSets.length,
        bestWeight: completedSets.reduce((max, set) => Math.max(max, milliKgToNumber(set.weightMilliKg)), 0),
        bestReps: completedSets.reduce((max, set) => Math.max(max, set.reps), 0),
        setsDetails: exercise.sets.map((set) => ({
          weight: milliKgToNumber(set.weightMilliKg),
          reps: set.reps,
          completed: set.completed,
          rpe: set.rpeTenths === null ? undefined : set.rpeTenths / 10,
          category: set.category,
          isUnilateral: set.isUnilateral,
          leftWeight: set.leftWeightMilliKg === null ? undefined : milliKgToNumber(set.leftWeightMilliKg),
          leftReps: set.leftReps ?? undefined,
          rightWeight: set.rightWeightMilliKg === null ? undefined : milliKgToNumber(set.rightWeightMilliKg),
          rightReps: set.rightReps ?? undefined,
        })),
      };
    }),
  };
}
