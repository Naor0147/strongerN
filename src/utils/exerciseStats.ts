import { WorkoutSession } from '../data/mockData';
import { isCompletedSet } from './setCounting';

// Monday of the week helper
function getMonday(date: Date): Date | null {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return isNaN(monday.getTime()) ? null : monday;
}

/**
 * Calculates completed sets per ISO-week bucket.
 */
export function setsPerWeek(
  exName: string,
  sessions: WorkoutSession[],
  variation?: string
): { weekStart: Date; count: number }[] {
  if (!exName || !Array.isArray(sessions) || sessions.length === 0) return [];
  const weekMap: Record<string, number> = {};

  for (const session of sessions) {
    if (!session || !session.datetime || !Array.isArray(session.exercises)) continue;
    const exSet = session.exercises.find(
      (e) => e && e.name && e.name.toLowerCase().trim() === exName.toLowerCase().trim() &&
        (variation ? (e.variation && e.variation.trim().toLowerCase() === variation.trim().toLowerCase()) : true)
    );
    if (!exSet || !Array.isArray(exSet.setsDetails)) continue;

    const completedSets = exSet.setsDetails.filter(isCompletedSet).length;
    if (completedSets === 0) continue;

    const monday = getMonday(new Date(session.datetime));
    if (!monday) continue;
    try {
      const key = monday.toISOString().split('T')[0];
      weekMap[key] = (weekMap[key] || 0) + completedSets;
    } catch (_) {}
  }

  const result = Object.entries(weekMap).map(([dateStr, count]) => ({
    weekStart: new Date(dateStr),
    count,
  })).filter((item) => !isNaN(item.weekStart.getTime()));

  return result.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

/**
 * Calculates average reps of completed sets per session.
 */
export function avgRepsPerWorkout(
  exName: string,
  sessions: WorkoutSession[],
  variation?: string
): { date: Date; avg: number }[] {
  if (!exName || !Array.isArray(sessions) || sessions.length === 0) return [];
  const result: { date: Date; avg: number }[] = [];

  const validSessions = sessions.filter((s) => s && s.datetime && !isNaN(new Date(s.datetime).getTime()));
  const sortedSessions = [...validSessions].sort((a, b) => {
    return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
  });

  for (const session of sortedSessions) {
    if (!Array.isArray(session.exercises)) continue;
    const exSet = session.exercises.find(
      (e) => e && e.name && e.name.toLowerCase().trim() === exName.toLowerCase().trim() &&
        (variation ? (e.variation && e.variation.trim().toLowerCase() === variation.trim().toLowerCase()) : true)
    );
    if (!exSet || !Array.isArray(exSet.setsDetails)) continue;

    const completed = exSet.setsDetails.filter(isCompletedSet);
    if (completed.length === 0) continue;

    const totalReps = completed.reduce((sum, s) => {
      const r = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps), 10);
      return sum + (isNaN(r) ? 0 : r);
    }, 0);
    const avg = totalReps / completed.length;
    if (isNaN(avg)) continue;

    const d = new Date(session.datetime);
    if (!isNaN(d.getTime())) {
      result.push({
        date: d,
        avg: Math.round(avg * 10) / 10,
      });
    }
  }

  return result;
}

/**
 * Returns the date of the latest session in which the exercise was performed.
 */
export function lastPerformed(
  exName: string,
  sessions: WorkoutSession[],
  variation?: string
): Date | null {
  let latestDate: Date | null = null;

  for (const session of sessions) {
    const exSet = session.exercises.find(
      (e) => e && e.name && e.name.toLowerCase().trim() === exName.toLowerCase().trim() &&
        (variation ? (e.variation && e.variation.trim().toLowerCase() === variation.trim().toLowerCase()) : true)
    );
    if (!exSet || !exSet.setsDetails) continue;

    const completedCount = exSet.setsDetails.filter((s) => s.completed).length;
    if (completedCount > 0) {
      const d = new Date(session.datetime);
      if (!latestDate || d.getTime() > latestDate.getTime()) {
        latestDate = d;
      }
    }
  }

  return latestDate;
}

/**
 * Returns the total count of completed sets all time.
 */
export function totalSetsAllTime(
  exName: string,
  sessions: WorkoutSession[],
  variation?: string
): number {
  let total = 0;

  for (const session of sessions) {
    const exSet = session.exercises.find(
      (e) => e && e.name && e.name.toLowerCase().trim() === exName.toLowerCase().trim() &&
        (variation ? (e.variation && e.variation.trim().toLowerCase() === variation.trim().toLowerCase()) : true)
    );
    if (!exSet || !exSet.setsDetails) continue;

    total += exSet.setsDetails.filter((s) => s.completed).length;
  }

  return total;
}

export interface VolumeRecommendation {
  min: number;
  max: number;
  message: string;
}

/**
 * Provides weekly set hypertrophy target range based on the muscle group.
 */
export function getVolumeRecommendation(muscleGroup?: string): VolumeRecommendation {
  const norm = (muscleGroup || '').toLowerCase().trim();

  // Hypertrophy guidelines: chest/back/legs: 10-20, arms/delts: 8-16, core: 6-12
  if (['chest', 'back', 'quads', 'hamstrings', 'glutes', 'legs'].includes(norm)) {
    return { min: 10, max: 20, message: '10–20 sets/week is optimal for large muscle hypertrophy.' };
  }
  if (['biceps', 'triceps', 'shoulders', 'arms', 'delts'].includes(norm)) {
    return { min: 8, max: 16, message: '8–16 sets/week is recommended for smaller muscle groups/arms.' };
  }
  if (['core', 'abs', 'obliques'].includes(norm)) {
    return { min: 6, max: 12, message: '6–12 sets/week is recommended for core stability and hypertrophy.' };
  }

  return { min: 8, max: 15, message: '8–15 sets/week is recommended for general muscle development.' };
}
