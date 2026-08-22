import { SetSuggestion } from '../components/layout/activeWorkoutTypes';

export interface ExpectedValueContext {
  routineName?: string;
  exercisePosition?: number;
  supersetGroupId?: string | null;
  progressiveOverloadEnabled?: boolean;
  equipment?: string;
  templateSuggestion?: Partial<SetSuggestion>;
  allowBaseVariationFallback?: boolean;
}

interface ExerciseHistoryEntry {
  timestamp: number;
  routineKey: string;
  position: number;
  variationKey: string;
  isSuperset: boolean;
  exercise: any;
  categorySets: Map<string, any[]>;
}

export interface ExpectedValuesIndex {
  byExercise: Map<string, ExerciseHistoryEntry[]>;
  cache: Map<string, SetSuggestion>;
  tierCache: Map<string, { tier: number; entries: ExerciseHistoryEntry[] } | null>;
}

interface Observation {
  weight: number;
  reps: number;
  rpe: number | null;
}

const emptySuggestion = (): SetSuggestion => ({
  weight: '',
  reps: '',
  leftWeight: '',
  leftReps: '',
  rightWeight: '',
  rightReps: '',
  sourceTier: 9,
  sampleSize: 0,
  confidence: 'none',
});

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function weightValue(set: any, key: 'weight' | 'leftWeight' | 'rightWeight'): number | null {
  const direct = numeric(set?.[key]);
  if (direct !== null) return direct;
  if (key === 'weight') {
    const kg = numeric(set?.weightKg);
    if (kg !== null) return kg;
    const milliKg = numeric(set?.weightMilliKg);
    return milliKg === null ? null : milliKg / 1000;
  }
  const milliKey = key === 'leftWeight' ? 'leftWeightMilliKg' : 'rightWeightMilliKg';
  const milliKg = numeric(set?.[milliKey]);
  return milliKg === null ? null : milliKg / 1000;
}

function sessionTimestamp(session: any): number {
  const value = session?.datetime ?? session?.startedAtMs;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function rawSets(exercise: any): any[] {
  if (Array.isArray(exercise?.setsDetails)) return exercise.setsDetails;
  if (Array.isArray(exercise?.sets)) return exercise.sets;
  return [];
}

function categoryOf(set: any): string {
  return set?.category ?? 'S';
}

function hasUsableSet(set: any): boolean {
  if (!set || set.completed === false) return false;
  const reps = numeric(set.reps) ?? numeric(set.leftReps) ?? numeric(set.rightReps);
  const bilateral = weightValue(set, 'weight');
  const left = weightValue(set, 'leftWeight');
  const right = weightValue(set, 'rightWeight');
  return reps !== null && reps > 0 && (bilateral !== null || left !== null || right !== null);
}

/** Build once per history revision; runtime resolution never scans or sorts all sessions. */
export function buildExerciseHistoryIndex(sessions: any[] | null | undefined): ExpectedValuesIndex {
  const byExercise = new Map<string, ExerciseHistoryEntry[]>();
  for (const session of sessions ?? []) {
    if (!Array.isArray(session?.exercises)) continue;
    const routineKey = normalized(session.titleNorm ?? session.title);
    const timestamp = sessionTimestamp(session);
    session.exercises.forEach((exercise: any, arrayPosition: number) => {
      const exerciseKey = normalized(exercise?.nameNorm ?? exercise?.nameSnapshot ?? exercise?.name);
      if (!exerciseKey) return;
      const entries = byExercise.get(exerciseKey) ?? [];
      const categorySets = new Map<string, any[]>();
      for (const set of rawSets(exercise)) {
        if (!hasUsableSet(set)) continue;
        const category = categoryOf(set);
        const sets = categorySets.get(category) ?? [];
        sets.push(set);
        categorySets.set(category, sets);
      }
      entries.push({
        timestamp,
        routineKey,
        position: Number.isFinite(exercise?.position) ? Math.max(0, Math.trunc(exercise.position)) : arrayPosition,
        variationKey: normalized(exercise?.variationKey ?? exercise?.variation),
        isSuperset: Boolean(exercise?.supersetGroupId ?? exercise?.superSetGroupId),
        exercise,
        categorySets,
      });
      byExercise.set(exerciseKey, entries);
    });
  }
  for (const entries of byExercise.values()) entries.sort((a, b) => b.timestamp - a.timestamp);
  return {
    byExercise,
    cache: new Map<string, SetSuggestion>(),
    tierCache: new Map<string, { tier: number; entries: ExerciseHistoryEntry[] } | null>(),
  };
}

interface PreparedTierContext {
  routineKey: string;
  hasRoutine: boolean;
  hasPosition: boolean;
  position: number;
  isSuperset: boolean;
  allowBaseVariationFallback: boolean;
}

function prepareTierContext(context: ExpectedValueContext): PreparedTierContext {
  const routineKey = normalized(context.routineName);
  const hasPosition = Number.isFinite(context.exercisePosition);
  return {
    routineKey,
    hasRoutine: routineKey.length > 0,
    hasPosition,
    position: hasPosition ? Math.max(0, Math.trunc(context.exercisePosition as number)) : -1,
    isSuperset: Boolean(context.supersetGroupId),
    allowBaseVariationFallback: context.allowBaseVariationFallback !== false,
  };
}

function classifyTier(entry: ExerciseHistoryEntry, targetVariation: string, context: PreparedTierContext): number | null {
  const exactVariation = entry.variationKey === targetVariation;
  if (!exactVariation) {
    return context.allowBaseVariationFallback && targetVariation !== '' && entry.variationKey === '' ? 8 : null;
  }
  if (!context.hasRoutine || !context.hasPosition) return 7;
  const sameRoutine = entry.routineKey === context.routineKey;
  const distance = Math.abs(entry.position - context.position);
  const sameSupersetMode = entry.isSuperset === context.isSuperset;
  if (sameRoutine && distance === 0 && sameSupersetMode) return 1;
  if (sameRoutine && distance === 0) return 2;
  if (sameRoutine && distance === 1) return 3;
  if (sameRoutine) return 4;
  if (distance === 0) return 5;
  if (distance === 1) return 6;
  return 7;
}

function chooseTier(entries: ExerciseHistoryEntry[], targetVariation: string, category: string, context: ExpectedValueContext): { tier: number; entries: ExerciseHistoryEntry[] } | null {
  const tiers = Array.from({ length: 8 }, () => [] as ExerciseHistoryEntry[]);
  const preparedContext = prepareTierContext(context);
  for (const entry of entries) {
    if (!entry.categorySets.has(category)) continue;
    const tier = classifyTier(entry, targetVariation, preparedContext);
    if (tier !== null) tiers[tier - 1].push(entry);
  }
  for (let tier = 1; tier <= 8; tier += 1) {
    if (tiers[tier - 1].length >= 5) return { tier, entries: tiers[tier - 1].slice(0, 5) };
  }
  for (let tier = 1; tier <= 8; tier += 1) {
    if (tiers[tier - 1].length > 0) return { tier, entries: tiers[tier - 1].slice(0, 5) };
  }
  return null;
}

function observationFor(entry: ExerciseHistoryEntry, category: string, ordinal: number, side?: 'left' | 'right'): Observation | null {
  const sets = entry.categorySets.get(category) ?? [];
  if (sets.length === 0) return null;
  const set = sets[Math.min(ordinal, sets.length - 1)];
  const sideWeight = side === 'left' ? weightValue(set, 'leftWeight') : side === 'right' ? weightValue(set, 'rightWeight') : null;
  const weight = sideWeight ?? weightValue(set, 'weight') ?? weightValue(set, side === 'left' ? 'rightWeight' : 'leftWeight');
  const sideReps = side === 'left' ? numeric(set.leftReps) : side === 'right' ? numeric(set.rightReps) : null;
  const reps = sideReps ?? numeric(set.reps);
  if (weight === null || reps === null || reps <= 0) return null;
  const rawRpe = numeric(set.rpeTenths) ?? numeric(set.rpe);
  return { weight, reps, rpe: rawRpe === null ? null : rawRpe > 10 ? rawRpe / 10 : rawRpe };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function theilSenNext(valuesNewestFirst: number[]): number {
  if (valuesNewestFirst.length <= 1) return valuesNewestFirst[0] ?? 0;
  const values = [...valuesNewestFirst].reverse();
  const slopes: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) slopes.push((values[j] - values[i]) / (j - i));
  }
  const slope = median(slopes);
  const intercept = median(values.map((value, index) => value - slope * index));
  return intercept + slope * values.length;
}

function e1rm(observation: Observation): number {
  return observation.weight <= 0 ? observation.reps : observation.weight * (1 + observation.reps / 30);
}

function withoutIsolatedDeload(observations: Observation[]): Observation[] {
  if (observations.length < 3) return observations;
  const latest = observations[0];
  const older = observations.slice(1);
  const olderMedian = median(older.map(e1rm));
  if (olderMedian <= 0 || e1rm(latest) > olderMedian * 0.9) return observations;
  const secondAlsoLow = observations.length >= 4 && e1rm(observations[1]) <= median(observations.slice(2).map(e1rm)) * 0.9;
  return secondAlsoLow ? observations : older;
}

function loadIncrement(equipment: string | undefined): number {
  const key = normalized(equipment);
  if (key.includes('bodyweight')) return 0;
  if (key.includes('barbell') || key.includes('machine')) return 2.5;
  return 1;
}

function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value) || value < 0) return '';
  return String(Number(value.toFixed(decimals)));
}

function predict(observationsNewestFirst: Observation[], context: ExpectedValueContext): { weight: string; reps: string } | null {
  if (observationsNewestFirst.length === 0) return null;
  const latestRaw = observationsNewestFirst[0];
  const observations = withoutIsolatedDeload(observationsNewestFirst);
  const progressive = context.progressiveOverloadEnabled === true;
  const increment = loadIncrement(context.equipment);
  let weight = observations.length < 3
    ? observations[0].weight
    : theilSenNext(observations.map(item => item.weight));
  let reps = observations.length < 3
    ? observations[0].reps
    : Math.max(1, Math.round(theilSenNext(observations.map(item => item.reps))));
  weight = Math.max(latestRaw.weight * 0.9, Math.min(weight, latestRaw.weight * 1.1));
  reps = Math.max(1, latestRaw.reps - 2, Math.min(reps, latestRaw.reps + 2));
  if (!progressive) {
    // Hard invariant: no upward weight or rep target unless the setting is on.
    weight = Math.min(weight, latestRaw.weight);
    reps = Math.min(reps, latestRaw.reps);
  } else {
    const highEffort = latestRaw.rpe !== null && latestRaw.rpe >= 9.5;
    const maxWeight = highEffort ? latestRaw.weight : latestRaw.weight + increment;
    const minWeight = latestRaw.weight > 0 ? latestRaw.weight * 0.95 : 0;
    weight = Math.max(minWeight, Math.min(weight, maxWeight));
    reps = Math.min(reps, highEffort ? latestRaw.reps : latestRaw.reps + 1);
    if (increment > 0 && weight > latestRaw.weight) {
      weight = Math.min(maxWeight, Math.floor(weight / increment) * increment);
      reps = Math.min(reps, latestRaw.reps);
    }
  }
  return { weight: formatNumber(Math.max(0, weight)), reps: formatNumber(Math.max(1, reps), 0) };
}

function confidence(sampleSize: number, tier: number): SetSuggestion['confidence'] {
  if (sampleSize >= 5 && tier <= 2) return 'high';
  if (sampleSize >= 3 && tier <= 5) return 'medium';
  return sampleSize > 0 ? 'low' : 'none';
}

function templateFallback(context: ExpectedValueContext): SetSuggestion {
  const suggestion = context.templateSuggestion;
  if (!suggestion) return emptySuggestion();
  return {
    ...emptySuggestion(),
    weight: String(suggestion.weight ?? ''),
    reps: String(suggestion.reps ?? ''),
    leftWeight: String(suggestion.leftWeight ?? suggestion.weight ?? ''),
    leftReps: String(suggestion.leftReps ?? suggestion.reps ?? ''),
    rightWeight: String(suggestion.rightWeight ?? suggestion.weight ?? ''),
    rightReps: String(suggestion.rightReps ?? suggestion.reps ?? ''),
  };
}

export function resolveLastPerformanceSuggestion(
  exerciseName: string,
  category: string,
  positionInCategory: number,
  sessions: any[],
  isUnilateral: boolean,
  targetVariation?: string,
  historyIndex?: ExpectedValuesIndex,
  context: ExpectedValueContext = {}
): SetSuggestion {
  const exerciseKey = normalized(exerciseName);
  if (!exerciseKey) return templateFallback(context);
  const index = historyIndex ?? buildExerciseHistoryIndex(sessions);
  const exerciseEntries = index.byExercise.get(exerciseKey);
  if ((!exerciseEntries || exerciseEntries.length === 0) && !context.templateSuggestion) {
    return emptySuggestion();
  }
  const variationKey = normalized(targetVariation);
  const ordinal = Math.max(0, Math.trunc(positionInCategory));
  const cacheKey = [exerciseKey, category, ordinal, isUnilateral ? 1 : 0, variationKey,
    normalized(context.routineName), context.exercisePosition ?? '', context.supersetGroupId ? 1 : 0,
    context.progressiveOverloadEnabled ? 1 : 0, normalized(context.equipment), context.allowBaseVariationFallback === false ? 0 : 1,
    context.templateSuggestion ? JSON.stringify(context.templateSuggestion) : ''].join('|');
  const cached = index.cache.get(cacheKey);
  if (cached) return cached;
  const tierCacheKey = [exerciseKey, category, variationKey, normalized(context.routineName),
    context.exercisePosition ?? '', context.supersetGroupId ? 1 : 0,
    context.allowBaseVariationFallback === false ? 0 : 1].join('|');
  let selection = index.tierCache.get(tierCacheKey);
  if (selection === undefined) {
    selection = chooseTier(exerciseEntries ?? [], variationKey, category, context);
    index.tierCache.set(tierCacheKey, selection);
  }
  if (!selection) {
    const fallback = templateFallback(context);
    index.cache.set(cacheKey, fallback);
    return fallback;
  }
  const bilateral = selection.entries.map(entry => observationFor(entry, category, ordinal)).filter((item): item is Observation => item !== null);
  const base = predict(bilateral, context);
  if (!base) {
    const fallback = templateFallback(context);
    index.cache.set(cacheKey, fallback);
    return fallback;
  }
  let result: SetSuggestion;
  if (!isUnilateral) {
    result = { weight: base.weight, reps: base.reps, leftWeight: base.weight, leftReps: base.reps, rightWeight: base.weight, rightReps: base.reps,
      sourceTier: selection.tier, sampleSize: bilateral.length, confidence: confidence(bilateral.length, selection.tier) };
  } else {
    const left = predict(selection.entries.map(entry => observationFor(entry, category, ordinal, 'left')).filter((item): item is Observation => item !== null), context) ?? base;
    const right = predict(selection.entries.map(entry => observationFor(entry, category, ordinal, 'right')).filter((item): item is Observation => item !== null), context) ?? base;
    result = { weight: left.weight, reps: left.reps, leftWeight: left.weight, leftReps: left.reps, rightWeight: right.weight, rightReps: right.reps,
      sourceTier: selection.tier, sampleSize: selection.entries.length, confidence: confidence(selection.entries.length, selection.tier) };
  }
  index.cache.set(cacheKey, result);
  return result;
}
