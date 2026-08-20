/**
 * exerciseHistory.ts
 *
 * Pure data transformation engine for exercise history breakdown and PR tracking.
 */

import { estimate1RM } from './strength';
import { isCompletedSet } from './setCounting';

export interface ExerciseHistorySet {
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
  category: 'W' | 'S' | 'D' | 'F';
  rpe?: number;
  est1RM: number;
  isUnilateral?: boolean;
  leftWeightKg?: number;
  leftReps?: number;
  rightWeightKg?: number;
  rightReps?: number;
}

export interface ExerciseHistorySession {
  id: string;
  date: Date;
  workoutTitle: string;
  sets: ExerciseHistorySet[];
  completedSetsCount: number;
  bestSet: ExerciseHistorySet | null;
  best1RM: number;
  isPr1RM: boolean;
  isPrWeight: boolean;
}

export function buildExerciseSessionHistory(
  exerciseName: string,
  sessions: any[]
): ExerciseHistorySession[] {
  if (!exerciseName || !sessions || !Array.isArray(sessions) || sessions.length === 0) {
    return [];
  }

  const targetName = exerciseName.toLowerCase().trim();
  const rawList: ExerciseHistorySession[] = [];

  const validSessions = sessions.filter((s) => s != null && typeof s === 'object');
  if (validSessions.length === 0) {
    return [];
  }

  // Iterate chronologically first to compute PR progression accurately
  const chronologicalSessions = [...validSessions].sort((a, b) => {
    const tA = new Date(a?.datetime || a?.date || 0).getTime() || 0;
    const tB = new Date(b?.datetime || b?.date || 0).getTime() || 0;
    return tA - tB;
  });

  let runningMax1RM = 0;
  let runningMaxWeight = 0;

  for (let i = 0; i < chronologicalSessions.length; i++) {
    const session = chronologicalSessions[i];
    if (!session) continue;

    const exercises = Array.isArray(session.exercises) ? session.exercises : [];
    const matchedEx = exercises.find((ex: any) => {
      const name = String(ex?.name || ex?.nameSnapshot || '').toLowerCase().trim();
      return name === targetName;
    });

    if (!matchedEx) continue;

    const rawSets = Array.isArray(matchedEx.setsDetails)
      ? matchedEx.setsDetails
      : Array.isArray(matchedEx.sets)
      ? matchedEx.sets
      : [];

    const normalizedSets: ExerciseHistorySet[] = [];
    let bestSet: ExerciseHistorySet | null = null;
    let best1RM = 0;
    let sessionMaxWeight = 0;
    let completedCount = 0;

    for (let setIdx = 0; setIdx < rawSets.length; setIdx++) {
      const s = rawSets[setIdx];
      if (!s) continue;

      const completed = isCompletedSet(s);
      const weightKg = Number(s.weightKg ?? s.weight ?? (s.weightMilliKg ? s.weightMilliKg / 1000 : 0));
      const reps = Number(s.reps ?? 0);
      const category = (s.category || 'S') as 'W' | 'S' | 'D' | 'F';
      const rpe = s.rpe ?? (s.rpeTenths ? s.rpeTenths / 10 : undefined);
      const isUnilateral = Boolean(s.isUnilateral);

      const est1RM = weightKg > 0 && reps > 0 ? estimate1RM(weightKg, reps) : 0;

      const historySet: ExerciseHistorySet = {
        setNumber: setIdx + 1,
        weightKg: Math.max(0, weightKg),
        reps: Math.max(0, reps),
        completed,
        category,
        rpe,
        est1RM: Math.round(est1RM),
        isUnilateral,
        leftWeightKg: s.leftWeightKg ?? s.leftWeight ?? undefined,
        leftReps: s.leftReps ?? undefined,
        rightWeightKg: s.rightWeightKg ?? s.rightWeight ?? undefined,
        rightReps: s.rightReps ?? undefined,
      };

      normalizedSets.push(historySet);

      if (completed) {
        completedCount++;
        if (est1RM > best1RM) {
          best1RM = est1RM;
          bestSet = historySet;
        }
        if (weightKg > sessionMaxWeight) {
          sessionMaxWeight = weightKg;
        }
      }
    }

    // Fallback best set if none completed
    if (!bestSet && normalizedSets.length > 0) {
      bestSet = normalizedSets[0];
      best1RM = normalizedSets[0].est1RM;
    }

    let isPr1RM = false;
    let isPrWeight = false;

    if (completedCount > 0) {
      if (best1RM > runningMax1RM && best1RM > 0) {
        isPr1RM = true;
        runningMax1RM = best1RM;
      }

      if (sessionMaxWeight > runningMaxWeight && sessionMaxWeight > 0) {
        isPrWeight = true;
        runningMaxWeight = sessionMaxWeight;
      }
    }

    const dt = session.datetime ? new Date(session.datetime) : (session.date ? new Date(session.date) : new Date());
    const validDate = isNaN(dt.getTime()) ? new Date() : dt;

    rawList.push({
      id: String(session.id || `sess-${validDate.getTime()}-${i}`),
      date: validDate,
      workoutTitle: String(session.title || 'Workout'),
      sets: normalizedSets,
      completedSetsCount: completedCount,
      bestSet,
      best1RM: Math.round(best1RM),
      isPr1RM,
      isPrWeight,
    });
  }

  // Return sorted descending (newest first)
  return rawList.sort((a, b) => b.date.getTime() - a.date.getTime());
}
