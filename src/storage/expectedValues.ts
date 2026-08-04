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
  const candidates = (mapped?.length ? mapped : sessions ?? [])
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
      return rawSets.some((set: any) => set?.completed !== false && (set?.category ?? 'S') === category);
    })
    .sort((a: any, b: any) => b.timestamp - a.timestamp);

  const latestExercise = candidates[0]?.exercise;
  if (!latestExercise) return zeroSuggestion();
  const rawSets = Array.isArray(latestExercise.setsDetails)
    ? latestExercise.setsDetails
    : Array.isArray(latestExercise.sets) ? latestExercise.sets : [];
  const performedSets = rawSets.filter((set: any) => set?.completed !== false);
  const matchingSets = performedSets.filter((set: any) => (set?.category ?? 'S') === category);
  if (matchingSets.length === 0) return zeroSuggestion();
  const ordinal = Math.max(0, Math.trunc(positionInCategory));
  const historicalSet = matchingSets[Math.min(ordinal, matchingSets.length - 1)];

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
