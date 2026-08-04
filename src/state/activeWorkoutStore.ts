import { create } from 'zustand';
import { ActiveWorkoutDraftV2 } from '../storage/contracts/types';
import { clearActiveWorkoutDraft, saveActiveWorkoutDraft } from '../storage/activeWorkoutSnapshot';
import { draftToRuntimeState, RuntimeActiveWorkoutState, runtimeStateToDraft } from '../storage/activeWorkoutBridge';
import { mmkvStorageAdapter } from '../storage/adapters/mmkvAdapter';

type StateAction<T> = T | ((previous: T) => T);

export interface ActiveWorkoutStoreState extends RuntimeActiveWorkoutState {
  isHydrated: boolean;
  persistenceError: string | null;
  hydrate: (draft: ActiveWorkoutDraftV2 | null) => void;
  beginWorkout: (state: Omit<RuntimeActiveWorkoutState, 'isWorkoutActive'>) => void;
  endWorkout: () => void;
  setWorkoutName: (value: StateAction<string>) => void;
  setStartTime: (value: StateAction<Date>) => void;
  setWorkoutExercises: (value: StateAction<any[]>) => void;
  setWorkoutModalVisible: (value: StateAction<boolean>) => void;
  setActiveWorkoutComment: (value: StateAction<string>) => void;
  setEditingSessionId: (value: StateAction<string | null>) => void;
}

const initialRuntimeState: RuntimeActiveWorkoutState = {
  isWorkoutActive: false,
  workoutName: 'Active Workout',
  startTime: new Date(),
  workoutExercises: [],
  isWorkoutModalVisible: false,
  activeWorkoutComment: '',
  editingSessionId: null,
};

function resolveAction<T>(action: StateAction<T>, previous: T): T {
  return typeof action === 'function' ? (action as (previous: T) => T)(previous) : action;
}

function runtimeFromStore(state: ActiveWorkoutStoreState, patch: Partial<RuntimeActiveWorkoutState> = {}): RuntimeActiveWorkoutState {
  return {
    isWorkoutActive: patch.isWorkoutActive ?? state.isWorkoutActive,
    workoutName: patch.workoutName ?? state.workoutName,
    startTime: patch.startTime ?? state.startTime,
    workoutExercises: patch.workoutExercises ?? state.workoutExercises,
    isWorkoutModalVisible: patch.isWorkoutModalVisible ?? state.isWorkoutModalVisible,
    activeWorkoutComment: patch.activeWorkoutComment ?? state.activeWorkoutComment,
    editingSessionId: patch.editingSessionId === undefined ? state.editingSessionId : patch.editingSessionId,
  };
}

export const useActiveWorkoutStore = create<ActiveWorkoutStoreState>((set, get) => {
  const commitPatch = (patch: Partial<RuntimeActiveWorkoutState>) => {
    const current = get();
    const next = runtimeFromStore(current, patch);
    if (current.isHydrated && next.isWorkoutActive && mmkvStorageAdapter.isAvailable()) {
      try {
        saveActiveWorkoutDraft(runtimeStateToDraft(next));
      } catch (error: any) {
        const message = error?.message ?? String(error);
        set({ persistenceError: message });
        throw error;
      }
    }
    set({ ...patch, persistenceError: null });
  };

  return {
    ...initialRuntimeState,
    isHydrated: false,
    persistenceError: null,
    hydrate: (draft) => {
      const runtime = draft ? draftToRuntimeState(draft) : initialRuntimeState;
      set({ ...runtime, isHydrated: true, persistenceError: null });
    },
    beginWorkout: (state) => {
      const next: RuntimeActiveWorkoutState = { ...state, isWorkoutActive: true };
      if (mmkvStorageAdapter.isAvailable()) {
        saveActiveWorkoutDraft(runtimeStateToDraft(next));
      }
      set({ ...next, isHydrated: true, persistenceError: null });
    },
    endWorkout: () => {
      if (mmkvStorageAdapter.isAvailable()) {
        clearActiveWorkoutDraft();
      }
      set({ ...initialRuntimeState, startTime: new Date(), isHydrated: true, persistenceError: null });
    },
    setWorkoutName: (value) => commitPatch({ workoutName: resolveAction(value, get().workoutName) }),
    setStartTime: (value) => commitPatch({ startTime: resolveAction(value, get().startTime) }),
    setWorkoutExercises: (value) => commitPatch({ workoutExercises: resolveAction(value, get().workoutExercises) }),
    setWorkoutModalVisible: (value) => commitPatch({ isWorkoutModalVisible: resolveAction(value, get().isWorkoutModalVisible) }),
    setActiveWorkoutComment: (value) => commitPatch({ activeWorkoutComment: resolveAction(value, get().activeWorkoutComment) }),
    setEditingSessionId: (value) => commitPatch({ editingSessionId: resolveAction(value, get().editingSessionId) }),
  };
});
