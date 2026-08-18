import { ActiveWorkoutDraftV2, LegacyActiveWorkoutV1 } from './contracts/types';
import { normalizeActiveWorkoutDraftV2 } from './contracts/validators';

export interface RuntimeActiveWorkoutState {
  isWorkoutActive: boolean;
  workoutName: string;
  startTime: Date;
  workoutExercises: any[];
  isWorkoutModalVisible: boolean;
  activeWorkoutComment: string;
  editingSessionId: string | null;
}
export function runtimeStateToDraft(state: RuntimeActiveWorkoutState): ActiveWorkoutDraftV2 {
  const startedAtMs = state.startTime instanceof Date
    ? state.startTime.getTime()
    : new Date(state.startTime as any).getTime();
  const safeStartedAtMs = Number.isFinite(startedAtMs) ? Math.max(0, Math.trunc(startedAtMs)) : Date.now();
  return normalizeActiveWorkoutDraftV2({
    schemaVersion: 2,
    draftId: `active-${safeStartedAtMs}`,
    revision: 1,
    writtenAtMs: Date.now(),
    payloadChecksum: '',
    isWorkoutActive: state.isWorkoutActive,
    workoutName: state.workoutName || 'Active Workout',
    startedAtMs: safeStartedAtMs,
    comment: state.activeWorkoutComment || '',
    isWorkoutModalVisible: false,
    editingSessionId: state.editingSessionId,
    restTimerDeadlineMs: null,
    restTimerDurationSec: null,
    exercises: (Array.isArray(state.workoutExercises) ? state.workoutExercises : [])
      .filter((exercise: any) => exercise && typeof exercise.name === 'string' && exercise.name.trim())
      .map((exercise: any) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId ?? null,
        name: exercise.name,
        variationKey: exercise.variation ?? exercise.variationKey ?? '',
        supersetGroupId: exercise.superSetGroupId ?? exercise.supersetGroupId ?? null,
        note: exercise.note ?? '',
        showNote: exercise.showNote ?? Boolean(exercise.note),
        isNoteLocked: exercise.isNoteLocked ?? false,
        autoTimer: exercise.autoTimer ?? null,
        sets: (Array.isArray(exercise.setsDetails)
          ? exercise.setsDetails
          : Array.isArray(exercise.sets) ? exercise.sets : [])
          .map((set: any) => ({
            id: set.id,
            category: set.category ?? 'S',
            completed: Boolean(set.completed),
            weightInput: String(set.weight ?? ''),
            repsInput: String(set.reps ?? ''),
            rpeInput: String(set.rpe ?? ''),
            isUnilateral: Boolean(set.isUnilateral),
            leftWeightInput: String(set.leftWeight ?? ''),
            leftRepsInput: String(set.leftReps ?? ''),
            rightWeightInput: String(set.rightWeight ?? ''),
            rightRepsInput: String(set.rightReps ?? ''),
            suggestedWeight: String(set.suggestedWeight ?? ''),
            suggestedReps: String(set.suggestedReps ?? ''),
            suggestedLeftWeight: String(set.suggestedLeftWeight ?? ''),
            suggestedLeftReps: String(set.suggestedLeftReps ?? ''),
            suggestedRightWeight: String(set.suggestedRightWeight ?? ''),
            suggestedRightReps: String(set.suggestedRightReps ?? ''),
          })),
      })),
  });
}

export function draftToRuntimeState(draft: ActiveWorkoutDraftV2): RuntimeActiveWorkoutState {
  return {
    isWorkoutActive: draft.isWorkoutActive,
    workoutName: draft.workoutName || 'Active Workout',
    startTime: new Date(draft.startedAtMs ?? Date.now()),
    workoutExercises: draft.exercises.map((exercise) => {
      const completedSets = exercise.sets.filter((set) => set.completed);
      const weights = completedSets.map((set) => Number(set.weightInput) || 0);
      const reps = completedSets.map((set) => Number(set.repsInput) || 0);
      return {
        id: exercise.id,
        exerciseId: exercise.exerciseId ?? undefined,
        name: exercise.name,
        variation: exercise.variationKey || undefined,
        superSetGroupId: exercise.supersetGroupId ?? undefined,
        note: exercise.note || undefined,
        showNote: exercise.showNote,
        isNoteLocked: exercise.isNoteLocked,
        autoTimer: exercise.autoTimer ?? undefined,
        sets: exercise.sets.length,
        bestWeight: weights.length ? Math.max(...weights) : 0,
        bestReps: reps.length ? Math.max(...reps) : 0,
        setsDetails: exercise.sets.map((set) => ({
          id: set.id,
          weight: set.weightInput,
          reps: set.repsInput,
          completed: set.completed,
          rpe: set.rpeInput || undefined,
          category: set.category,
          isUnilateral: set.isUnilateral,
          leftWeight: set.isUnilateral ? set.leftWeightInput : undefined,
          leftReps: set.isUnilateral ? set.leftRepsInput : undefined,
          rightWeight: set.isUnilateral ? set.rightWeightInput : undefined,
          rightReps: set.isUnilateral ? set.rightRepsInput : undefined,
          suggestedWeight: set.suggestedWeight,
          suggestedReps: set.suggestedReps,
          suggestedLeftWeight: set.isUnilateral ? set.suggestedLeftWeight : undefined,
          suggestedLeftReps: set.isUnilateral ? set.suggestedLeftReps : undefined,
          suggestedRightWeight: set.isUnilateral ? set.suggestedRightWeight : undefined,
          suggestedRightReps: set.isUnilateral ? set.suggestedRightReps : undefined,
        })),
      };
    }),
    isWorkoutModalVisible: false,
    activeWorkoutComment: draft.comment,
    editingSessionId: draft.editingSessionId,
  };
}

export function legacyActiveWorkoutToRuntime(raw: LegacyActiveWorkoutV1): RuntimeActiveWorkoutState {
  const startTime = new Date(raw.startTime ?? Date.now());
  return {
    isWorkoutActive: raw.isWorkoutActive !== false,
    workoutName: raw.workoutName || 'Active Workout',
    startTime: Number.isFinite(startTime.getTime()) ? startTime : new Date(),
    workoutExercises: Array.isArray(raw.workoutExercises) ? raw.workoutExercises : [],
    isWorkoutModalVisible: false,
    activeWorkoutComment: raw.comment || '',
    editingSessionId: null,
  };
}

export function runtimeToLegacyActiveWorkout(state: RuntimeActiveWorkoutState): LegacyActiveWorkoutV1 {
  return {
    isWorkoutActive: state.isWorkoutActive,
    workoutName: state.workoutName,
    startTime: state.startTime.toISOString(),
    workoutExercises: state.workoutExercises,
    isWorkoutModalVisible: false,
    comment: state.activeWorkoutComment,
  };
}
