import { SetDetail, WorkoutSession } from '../data/mockData';

/**
 * Estimates the 1-Rep Max (1RM) using the average of Epley and Brzycki formulas.
 * Falls back to Epley alone if reps are >= 37 to avoid division by zero or negative values.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps < 1 || weight <= 0) return 0;
  if (reps === 1) return weight;
  
  const epley = weight * (1 + reps / 30);
  if (reps >= 37) return epley;
  
  const brzycki = (weight * 36) / (37 - reps);
  return (epley + brzycki) / 2;
}

/**
 * Finds the completed set that has the highest Epley 1RM.
 */
export function bestSetBy1RM(sets: SetDetail[]): SetDetail | null {
  let bestSet: SetDetail | null = null;
  let highest1RM = -1;
  
  for (const set of sets) {
    if (!set.completed) continue;
    const oneRM = estimate1RM(set.weight, set.reps);
    if (oneRM > highest1RM) {
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
  const series: { date: Date; value: number }[] = [];
  
  // Sort sessions chronologically (oldest to newest)
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
  });

  for (const session of sortedSessions) {
    const exerciseSet = session.exercises.find(
      (e) => e.name.toLowerCase() === exName.toLowerCase()
    );
    if (!exerciseSet || !exerciseSet.setsDetails) continue;
    
    const bestSet = bestSetBy1RM(exerciseSet.setsDetails);
    if (bestSet) {
      const oneRM = estimate1RM(bestSet.weight, bestSet.reps);
      if (oneRM > 0) {
        series.push({
          date: new Date(session.datetime),
          value: Math.round(oneRM * 10) / 10,
        });
      }
    }
  }

  return series;
}
