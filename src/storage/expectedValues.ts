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

function hasUsablePerformance(set: any, isUnilateral: boolean): boolean {
  const hasNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return false;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  };
  if (isUnilateral) {
    return hasNumber(set?.leftWeight ?? set?.weight ?? set?.weightKg)
      && hasNumber(set?.leftReps ?? set?.reps)
      && hasNumber(set?.rightWeight ?? set?.weight ?? set?.weightKg)
      && hasNumber(set?.rightReps ?? set?.reps);
  }
  return hasNumber(set?.weight ?? set?.weightKg) && hasNumber(set?.reps);
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
  const isIndexedLookup = Array.isArray(mapped) && mapped.length > 0;
  const source: any[] = isIndexedLookup && mapped ? mapped : (sessions ?? []);
  const candidates = source
    .map((entry: any) => {
      if (entry?.ex) return { session: entry, exercise: entry.ex, timestamp: sessionTimestamp(entry) };
      const exercise = Array.isArray(entry?.exercises)
        ? entry.exercises.find((item: any) => normalized(item?.name) === exerciseKey)
        : null;
      return { session: entry, exercise, timestamp: sessionTimestamp(entry) };
    })
    .filter(({ exercise }: any) => {
      if (!exercise || normalized(exercise.name) !== exerciseKey) return false;
      if (targetVariation !== undefined
        && normalized(exercise.variation ?? exercise.variationKey) !== normalized(targetVariation)) return false;
      const rawSets = Array.isArray(exercise.setsDetails)
        ? exercise.setsDetails
        : Array.isArray(exercise.sets) ? exercise.sets : [];
      return rawSets.some((set: any) => set?.completed !== false
        && (set?.category ?? 'S') === category
        && hasUsablePerformance(set, isUnilateral));
    });

  if (!isIndexedLookup) {
    candidates.sort((a: any, b: any) => b.timestamp - a.timestamp);
  }

  const ordinal = Math.max(0, Math.trunc(positionInCategory));
  let historicalSet: any = null;
  for (const candidate of candidates) {
    const rawSets = Array.isArray(candidate.exercise.setsDetails)
      ? candidate.exercise.setsDetails
      : Array.isArray(candidate.exercise.sets) ? candidate.exercise.sets : [];
    const matchingSets = rawSets.filter((set: any) => set?.completed !== false
      && (set?.category ?? 'S') === category
      && hasUsablePerformance(set, isUnilateral));
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
