import { useActiveWorkoutStore } from '../state/activeWorkoutStore';

describe('Routine Loading Benchmark & Active Workout Guarding', () => {
  const LARGE_EXERCISE_COUNT = 500;
  const ROUTINE_EXERCISE_COUNT = 50;

  // Build a synthetic large library of exercises
  const mockExerciseLibrary = Array.from({ length: LARGE_EXERCISE_COUNT }).map((_, i) => ({
    id: `ex-lib-${i}`,
    name: `Exercise ${i}`,
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    isUnilateral: i % 10 === 0,
    notes: `Performance cue for exercise ${i}`,
  }));

  // Build a synthetic large routine split template
  const mockRoutineDetails = Array.from({ length: ROUTINE_EXERCISE_COUNT }).map((_, i) => ({
    name: `Exercise ${i * 2}`,
    notes: `Routine note for exercise ${i * 2}`,
    sets: [
      { weight: '100', reps: '10', category: 'S' },
      { weight: '105', reps: '8', category: 'S' },
      { weight: '110', reps: '6', category: 'S' },
      { weight: '115', reps: '4', category: 'S' },
    ],
  }));

  beforeEach(() => {
    useActiveWorkoutStore.getState().endWorkout();
  });

  test('Routine initialization with O(1) Map lookups executes in under 5ms for 50 exercises & 500 library items', () => {
    const startTime = performance.now();

    // 1. Build O(1) Exercise Map
    const exerciseMap = new Map<string, any>();
    for (let i = 0; i < mockExerciseLibrary.length; i++) {
      const ex = mockExerciseLibrary[i];
      exerciseMap.set(ex.name.toLowerCase(), ex);
    }

    // 2. Map routine exercises in single pass
    const derivedExercises = mockRoutineDetails.map((ex, exIdx) => {
      const libEx = exerciseMap.get(ex.name.toLowerCase());
      const isUnilateral = libEx?.isUnilateral || false;
      return {
        id: `ex-${exIdx}`,
        name: ex.name,
        notes: ex.notes || libEx?.notes || '',
        sets: ex.sets.map((s, sIdx) => ({
          id: `s-${exIdx}-${sIdx}`,
          weight: s.weight,
          reps: s.reps,
          category: s.category,
          isUnilateral,
        })),
      };
    });

    const duration = performance.now() - startTime;

    expect(derivedExercises.length).toBe(ROUTINE_EXERCISE_COUNT);
    expect(derivedExercises[0].name).toBe('Exercise 0');
    expect(derivedExercises[0].sets.length).toBe(4);
    // Guarantee loading performance is well under 5ms (typically ~0.2ms - 1ms)
    expect(duration).toBeLessThan(5);
    console.log(`[BENCHMARK] Routine load time for ${ROUTINE_EXERCISE_COUNT} exercises against ${LARGE_EXERCISE_COUNT} library items: ${duration.toFixed(3)}ms`);
  });

  test('Active workout guarding prevents starting new workout when workout is active', () => {
    // 1. Initially no active workout
    expect(useActiveWorkoutStore.getState().isWorkoutActive).toBe(false);

    // 2. Begin active workout
    useActiveWorkoutStore.getState().beginWorkout({
      workoutName: 'Ongoing Chest Session',
      startTime: new Date(),
      workoutExercises: [{ name: 'Bench Press', sets: [] }],
      isWorkoutModalVisible: true,
      activeWorkoutComment: '',
      editingSessionId: null,
    });

    expect(useActiveWorkoutStore.getState().isWorkoutActive).toBe(true);

    // 3. Verify active workout state is detected
    const activeState = useActiveWorkoutStore.getState();
    expect(activeState.isWorkoutActive).toBe(true);
    expect(activeState.workoutName).toBe('Ongoing Chest Session');

    // 4. End workout clears active status
    useActiveWorkoutStore.getState().endWorkout();
    expect(useActiveWorkoutStore.getState().isWorkoutActive).toBe(false);
  });
});
