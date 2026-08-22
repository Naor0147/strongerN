import { SetDetail, WorkoutSession } from '../data/mockData';

/**
 * Estimates the 1-Rep Max (1RM) using the average of Epley and Brzycki formulas.
 * Falls back to Epley alone if reps are >= 37 to avoid division by zero or negative values.
 */
export function estimate1RM(weight: number, reps: number): number {
  const w = typeof weight === 'number' ? weight : parseFloat(String(weight));
  const r = typeof reps === 'number' ? reps : parseInt(String(reps), 10);
  if (isNaN(w) || isNaN(r) || r < 1 || w <= 0) return 0;
  if (r === 1) return w;

  const epley = w * (1 + r / 30);
  if (r >= 37) return epley;

  const brzycki = (w * 36) / (37 - r);
  const result = (epley + brzycki) / 2;
  return isNaN(result) ? 0 : result;
}

/**
 * Finds the completed set that has the highest Epley 1RM.
 */
export function bestSetBy1RM(sets: SetDetail[]): SetDetail | null {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  let bestSet: SetDetail | null = null;
  let highest1RM = -1;

  for (const set of sets) {
    if (!set || !set.completed) continue;
    const w = typeof set.weight === 'number' ? set.weight : parseFloat(String(set.weight));
    const r = typeof set.reps === 'number' ? set.reps : parseInt(String(set.reps), 10);
    const oneRM = estimate1RM(w, r);
    if (!isNaN(oneRM) && oneRM > highest1RM) {
      highest1RM = oneRM;
      bestSet = set;
    }
  }

  return bestSet;
}

/**
 * Generates a chronological time series of 1RM values for a given exercise,
 * picking the best set's 1RM for each session the exercise was performed.
 */
export function exercise1RMSeries(
  exName: string,
  sessions: WorkoutSession[]
): { date: Date; value: number }[] {
  if (!exName || !Array.isArray(sessions) || sessions.length === 0) return [];
  const series: { date: Date; value: number }[] = [];

  // Sort sessions chronologically (oldest to newest)
  const validSessions = sessions.filter((s) => s && s.datetime && !isNaN(new Date(s.datetime).getTime()));
  const sortedSessions = [...validSessions].sort((a, b) => {
    return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
  });

  for (const session of sortedSessions) {
    if (!Array.isArray(session.exercises)) continue;
    const exerciseSet = session.exercises.find(
      (e) => e && e.name && e.name.toLowerCase() === exName.toLowerCase()
    );
    if (!exerciseSet || !Array.isArray(exerciseSet.setsDetails)) continue;

    const bestSet = bestSetBy1RM(exerciseSet.setsDetails);
    if (bestSet) {
      const w = typeof bestSet.weight === 'number' ? bestSet.weight : parseFloat(String(bestSet.weight));
      const r = typeof bestSet.reps === 'number' ? bestSet.reps : parseInt(String(bestSet.reps), 10);
      const oneRM = estimate1RM(w, r);
      if (!isNaN(oneRM) && oneRM > 0) {
        const d = new Date(session.datetime);
        if (!isNaN(d.getTime())) {
          series.push({
            date: d,
            value: Math.round(oneRM * 10) / 10,
          });
        }
      }
    }
  }

  return series;
}
