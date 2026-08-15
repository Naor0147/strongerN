import { activeExerciseStructureReducer } from '../state/activeExerciseReducer';
import { ActiveExercise } from '../components/layout/activeWorkoutTypes';

const exercise = (id: string, values: string[]): ActiveExercise => ({
  id,
  name: id,
  sets: values.map((weight, index) => ({
    id: `${id}-set-${index}`,
    weight,
    reps: String(10 - index),
    rpe: String(7 + index),
    completed: index === 0,
    category: 'S',
    suggestedWeight: `old-${index}`,
    suggestedReps: `old-${index}`,
  })),
});

describe('activeExerciseStructureReducer', () => {
  const recalculate = (item: ActiveExercise, position: number): ActiveExercise => ({
    ...item,
    sets: item.sets.map((set, setIndex) => ({
      ...set,
      suggestedWeight: `ghost-${position}-${setIndex}`,
      suggestedReps: `ghost-${position}-${setIndex}`,
    })),
  });

  test('deleting a set re-indexes ghosts without touching committed fields', () => {
    const initial = [exercise('bench', ['100', '95', '90'])];
    const next = activeExerciseStructureReducer(
      initial,
      { type: 'delete-set', exerciseIndex: 0, setIndex: 1 },
      recalculate,
    );
    expect(next[0].sets.map((set) => set.id)).toEqual(['bench-set-0', 'bench-set-2']);
    expect(next[0].sets[1]).toMatchObject({
      weight: '90', reps: '8', rpe: '9', suggestedWeight: 'ghost-0-1', suggestedReps: 'ghost-0-1',
    });
  });

  test('deleting an exercise recalculates later positions while preserving stable IDs and inputs', () => {
    const initial = [exercise('first', ['50']), exercise('second', ['80'])];
    const next = activeExerciseStructureReducer(
      initial,
      { type: 'delete-exercise', exerciseIndex: 0 },
      recalculate,
    );
    expect(next[0]).toMatchObject({ id: 'second', sets: [{ id: 'second-set-0', weight: '80', reps: '10', suggestedWeight: 'ghost-0-0' }] });
  });
});
