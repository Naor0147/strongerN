import { SetSuggestion } from '../components/layout/activeWorkoutTypes';

const zeroSuggestion = (): SetSuggestion => ({
  weight: '0',
  reps: '0',
  leftWeight: '0',
  leftReps: '0',
  rightWeight: '0',
  rightReps: '0',
});

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function exactNumericString(value: unknown): string {
  if (value === null || value === undefined || value === '') return '0';
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : '0';
}

function sessionTimestamp(session: any): number {
  const value = session?.datetime ?? session?.startedAtMs;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Build this once when a workout starts. Resolving every set against the full
 * session list made long routines repeatedly sort the same history on the JS
 * thread.
 */
export function buildExerciseHistoryIndex(sessions: any[] | null | undefined): Map<string, any[]> {
  const index = new Map<string, any[]>();
  for (const session of sessions ?? []) {
    if (!Array.isArray(session?.exercises)) continue;
    for (const exercise of session.exercises) {
      const key = normalized(exercise?.name);
      if (!key) continue;
      const entries = index.get(key) ?? [];
      entries.push({ datetime: session.datetime ?? session.startedAtMs, startedAtMs: session.startedAtMs, ex: exercise });
      index.set(key, entries);
    }
  }
  for (const entries of index.values()) {
    entries.sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a));
  }
  return index;
}

function isNonEmptyNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function hasUsablePerformance(set: any, isUnilateral: boolean): boolean {
  if (!set) return false;
  if (isUnilateral) {
    return isNonEmptyNumber(set.leftWeight ?? set.weight ?? set.weightKg)
      && isNonEmptyNumber(set.leftReps ?? set.reps)
      && isNonEmptyNumber(set.rightWeight ?? set.weight ?? set.weightKg)
      && isNonEmptyNumber(set.rightReps ?? set.reps);
  }
  return isNonEmptyNumber(set.weight ?? set.weightKg) && isNonEmptyNumber(set.reps);
}

export function resolveLastPerformanceSuggestion(
  exerciseName: string,
  category: string,
  positionInCategory: number,
  sessions: any[],
  isUnilateral: boolean,
  targetVariation?: string,
  sessionsMap?: Map<string, any[]>
): SetSuggestion {
  const exerciseKey = normalized(exerciseName);
  if (!exerciseKey) return zeroSuggestion();

  const mapped = sessionsMap?.get(exerciseKey);
  const isIndexedLookup = Boolean(sessionsMap);
  const source: any[] = sessionsMap ? (mapped ?? []) : (sessions ?? []);
  const normTargetVar = targetVariation !== undefined ? normalized(targetVariation) : undefined;
  const ordinal = Math.max(0, Math.trunc(positionInCategory));

  let historicalSet: any = null;

  for (let i = 0; i < source.length; i++) {
    const entry = source[i];
    const exercise = isIndexedLookup
      ? entry?.ex
      : (Array.isArray(entry?.exercises)
          ? entry.exercises.find((item: any) => normalized(item?.name) === exerciseKey)
          : null);

    if (!exercise) continue;
    if (!isIndexedLookup && normalized(exercise.name) !== exerciseKey) continue;
    if (normTargetVar !== undefined && normalized(exercise.variation ?? exercise.variationKey) !== normTargetVar) continue;

    const rawSets = Array.isArray(exercise.setsDetails)
      ? exercise.setsDetails
      : Array.isArray(exercise.sets) ? exercise.sets : [];

    const matchingSets: any[] = [];
    for (let sIdx = 0; sIdx < rawSets.length; sIdx++) {
      const set = rawSets[sIdx];
      if (set?.completed !== false && (set?.category ?? 'S') === category && hasUsablePerformance(set, isUnilateral)) {
        matchingSets.push(set);
      }
    }

    if (matchingSets.length > 0) {
      historicalSet = matchingSets[Math.min(ordinal, matchingSets.length - 1)];
      break;
    }
  }

  if (!historicalSet) return zeroSuggestion();

  const weight = exactNumericString(historicalSet.weight ?? historicalSet.weightKg);
  const reps = exactNumericString(historicalSet.reps);
  if (!isUnilateral) {
    return { weight, reps, leftWeight: weight, leftReps: reps, rightWeight: weight, rightReps: reps };
  }
  const leftWeight = exactNumericString(historicalSet.leftWeight ?? historicalSet.weight ?? historicalSet.weightKg);
  const leftReps = exactNumericString(historicalSet.leftReps ?? historicalSet.reps);
  const rightWeight = exactNumericString(historicalSet.rightWeight ?? historicalSet.weight ?? historicalSet.weightKg);
  const rightReps = exactNumericString(historicalSet.rightReps ?? historicalSet.reps);
  return {
    weight: leftWeight,
    reps: leftReps,
    leftWeight,
    leftReps,
    rightWeight,
    rightReps,
  };
}
