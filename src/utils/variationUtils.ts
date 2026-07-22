import { Exercise, WorkoutSession } from '../data/mockData';

/**
 * Sanitizes tag inputs: trims leading/trailing whitespace,
 * collapses internal multiple spaces into single space, and Title Cases words.
 * Example: "  icon   push  " -> "Icon Push"
 */
export function normalizeTag(input: string): string {
  if (!input) return '';
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  
  return trimmed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validates if tag string is valid (non-empty and max 40 chars).
 */
export function isValidTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  return normalized.length >= 1 && normalized.length <= 40;
}

/**
 * Adds a variation tag to an exercise's variation pool (deduplicated by normalized name).
 */
export function addVariationToExercise(exercise: Exercise, tag: string): Exercise {
  const normalized = normalizeTag(tag);
  if (!normalized || !isValidTag(normalized)) return exercise;
  
  const currentVars = (exercise.variations || []).filter((v): v is string => Boolean(v && typeof v === 'string'));
  if (currentVars.some(v => v.toLowerCase() === normalized.toLowerCase())) {
    return exercise;
  }
  
  return {
    ...exercise,
    variations: [...currentVars, normalized],
  };
}

/**
 * Removes a variation tag from an exercise (soft deletion from global pool).
 */
export function removeVariationFromExercise(exercise: Exercise, tag: string): Exercise {
  const normalized = normalizeTag(tag);
  const currentVars = (exercise.variations || []).filter((v): v is string => Boolean(v && typeof v === 'string'));
  return {
    ...exercise,
    variations: currentVars.filter(v => v.toLowerCase() !== normalized.toLowerCase()),
  };
}

/**
 * Filters sessions for a given exercise variation tag.
 * Implements "First Tag Inheritance":
 *   - If no variation is selected (Base State), return sessions with empty/undefined variation.
 *   - If this is the FIRST tag created/selected for an exercise with no other tag history,
 *     inherit the base exercise history.
 *   - If other tags already have logged history, subsequent new tags start at 0 history.
 */
export function getSessionsForExerciseVariation(
  exerciseName: string,
  variation: string | undefined,
  exercise: Exercise | undefined,
  sessions: WorkoutSession[]
): WorkoutSession[] {
  if (!exerciseName || !sessions || !Array.isArray(sessions) || sessions.length === 0) return [];
  
  const normExName = exerciseName.toLowerCase().trim();
  const normVar = variation ? normalizeTag(variation) : undefined;
  
  // 1. If no variation selected (Base State), return sessions that have no variation logged
  if (!normVar) {
    return sessions.filter(s =>
      s && Array.isArray(s.exercises) && s.exercises.some(e =>
        e && e.name && typeof e.name === 'string' && e.name.toLowerCase().trim() === normExName && (!e.variation || e.variation.trim() === '')
      )
    );
  }
  
  // 2. Look for sessions explicitly matching this variation
  const exactMatches = sessions.filter(s =>
    s && Array.isArray(s.exercises) && s.exercises.some(e =>
      e && e.name && typeof e.name === 'string' && e.name.toLowerCase().trim() === normExName &&
      e.variation && typeof e.variation === 'string' && normalizeTag(e.variation) === normVar
    )
  );
  
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // 3. First Tag Inheritance rule:
  // Check if any OTHER variation already has logged history for this exercise.
  const hasOtherVariationHistory = sessions.some(s =>
    s && Array.isArray(s.exercises) && s.exercises.some(e =>
      e && e.name && typeof e.name === 'string' && e.name.toLowerCase().trim() === normExName &&
      e.variation && typeof e.variation === 'string' && normalizeTag(e.variation) !== normVar
    )
  );

  // If no other variation has history, and this is the first tag assigned to the exercise,
  // inherit the base exercise's existing history (sessions where variation is empty/undefined).
  if (!hasOtherVariationHistory) {
    const baseSessions = sessions.filter(s =>
      s && Array.isArray(s.exercises) && s.exercises.some(e =>
        e && e.name && typeof e.name === 'string' && e.name.toLowerCase().trim() === normExName && (!e.variation || e.variation.trim() === '')
      )
    );
    return baseSessions;
  }
  
  // Subsequent tags start from zero if other tags already have history
  return [];
}
