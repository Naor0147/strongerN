import { WorkoutSession } from '../data/mockData';

// Monday of the week helper
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Calculates completed sets per ISO-week bucket.
 */
export function setsPerWeek(
  exName: string,
  sessions: WorkoutSession[]
): { weekStart: Date; count: number }[] {
  const weekMap: Record<string, number> = {};

  for (const session of sessions) {
    const exSet = session.exercises.find(
      (e) => e.name.toLowerCase() === exName.toLowerCase()
    );
    if (!exSet || !exSet.setsDetails) continue;

    const completedSets = exSet.setsDetails.filter((s) => s.completed).length;
    if (completedSets === 0) continue;

    const monday = getMonday(new Date(session.datetime));
    const key = monday.toISOString().split('T')[0];
    weekMap[key] = (weekMap[key] || 0) + completedSets;
  }

  const result = Object.entries(weekMap).map(([dateStr, count]) => ({
    weekStart: new Date(dateStr),
    count,
  }));

  return result.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

/**
 * Calculates average reps of completed sets per session.
 */
export function avgRepsPerWorkout(
  exName: string,
  sessions: WorkoutSession[]
): { date: Date; avg: number }[] {
  const result: { date: Date; avg: number }[] = [];

  // Sort sessions chronologically (oldest to newest)
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
  });

  for (const session of sortedSessions) {
    const exSet = session.exercises.find(
      (e) => e.name.toLowerCase() === exName.toLowerCase()
    );
    if (!exSet || !exSet.setsDetails) continue;

    const completed = exSet.setsDetails.filter((s) => s.completed);
    if (completed.length === 0) continue;

    const totalReps = completed.reduce((sum, s) => sum + s.reps, 0);
    const avg = totalReps / completed.length;

    result.push({
      date: new Date(session.datetime),
      avg: Math.round(avg * 10) / 10,
    });
  }

  return result;
}

/**
 * Returns the date of the latest session in which the exercise was performed.
 */
export function lastPerformed(
  exName: string,
  sessions: WorkoutSession[]
): Date | null {
  let latestDate: Date | null = null;

  for (const session of sessions) {
    const exSet = session.exercises.find(
      (e) => e.name.toLowerCase() === exName.toLowerCase()
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
  sessions: WorkoutSession[]
): number {
  let total = 0;

  for (const session of sessions) {
    const exSet = session.exercises.find(
      (e) => e.name.toLowerCase() === exName.toLowerCase()
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
