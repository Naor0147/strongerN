/**
 * setCounting.ts
 *
 * Canonical foundation for completed-set counting across the application.
 * Invariant: A set counts toward any aggregate iff completed === true (or completed === 1 in SQLite).
 */

export function isCompletedSet(set: unknown): boolean {
  if (!set || typeof set !== 'object') {
    return false;
  }
  const s = set as { completed?: unknown };
  return s.completed === true || s.completed === 1;
}

export function countCompletedSets(sets: unknown[] | null | undefined): number {
  if (!Array.isArray(sets)) return 0;
  let count = 0;
  for (let i = 0; i < sets.length; i++) {
    if (isCompletedSet(sets[i])) {
      count++;
    }
  }
  return count;
}

export function countCompletedSetsInExercise(exercise: unknown): number {
  if (!exercise || typeof exercise !== 'object') return 0;
  const ex = exercise as {
    setsDetails?: unknown[];
    sets?: unknown[] | number;
  };

  if (Array.isArray(ex.setsDetails) && ex.setsDetails.length > 0) {
    return countCompletedSets(ex.setsDetails);
  }

  if (Array.isArray(ex.sets)) {
    return countCompletedSets(ex.sets);
  }

  if (typeof ex.sets === 'number' && Number.isFinite(ex.sets)) {
    return Math.max(0, Math.floor(ex.sets));
  }

  return 0;
}

export function countCompletedSetsInSession(session: unknown): number {
  if (!session || typeof session !== 'object') return 0;
  const s = session as { exercises?: unknown[] };
  if (!Array.isArray(s.exercises)) return 0;

  let total = 0;
  for (let i = 0; i < s.exercises.length; i++) {
    total += countCompletedSetsInExercise(s.exercises[i]);
  }
  return total;
}
