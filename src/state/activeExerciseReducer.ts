import { ActiveExercise } from '../components/layout/activeWorkoutTypes';
import { sanitizeSuperSets } from '../components/layout/activeWorkoutUtils';

export type ActiveExerciseStructureAction =
  | { type: 'delete-set'; exerciseIndex: number; setIndex: number }
  | { type: 'delete-exercise'; exerciseIndex: number }
  | { type: 'reorder'; exercises: ActiveExercise[] };

type RecalculateExpectedValues = (exercise: ActiveExercise, exercisePosition: number) => ActiveExercise;

/**
 * Pure structural state transition. Recalculation is deliberately delegated to
 * a suggestion-only callback so committed set fields can never be replaced by
 * historical targets during deletion, re-indexing, or reordering.
 */
export function activeExerciseStructureReducer(
  state: ActiveExercise[],
  action: ActiveExerciseStructureAction,
  recalculateExpectedValues: RecalculateExpectedValues,
): ActiveExercise[] {
  if (action.type === 'delete-set') {
    const exercise = state[action.exerciseIndex];
    if (!exercise?.sets[action.setIndex]) return state;
    const next = [...state];
    next[action.exerciseIndex] = recalculateExpectedValues({
      ...exercise,
      sets: exercise.sets.filter((_, index) => index !== action.setIndex),
    }, action.exerciseIndex);
    return next;
  }

  const structural = action.type === 'delete-exercise'
    ? state.filter((_, index) => index !== action.exerciseIndex)
    : action.exercises;
  return sanitizeSuperSets(structural).map((exercise, position) => (
    recalculateExpectedValues(exercise, position)
  ));
}
