import { AppState } from 'react-native';
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

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDraftToSave: ActiveWorkoutDraftV2 | null = null;

export function flushActiveWorkoutDraftSync(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingDraftToSave && mmkvStorageAdapter.isAvailable()) {
    try {
      saveActiveWorkoutDraft(pendingDraftToSave);
      pendingDraftToSave = null;
    } catch (error: any) {
      console.warn('[activeWorkoutStore] Error flushing active workout draft:', error);
    }
  }
}

function scheduleDraftSave(draft: ActiveWorkoutDraftV2, delayMs = 400): void {
  pendingDraftToSave = draft;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (pendingDraftToSave && mmkvStorageAdapter.isAvailable()) {
      try {
        saveActiveWorkoutDraft(pendingDraftToSave);
        pendingDraftToSave = null;
      } catch (error: any) {
        console.warn('[activeWorkoutStore] Error saving active workout draft:', error);
      }
    }
  }, delayMs);
}

// Flush immediately when app moves to background or becomes inactive
if (typeof AppState !== 'undefined' && AppState.addEventListener) {
  AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      flushActiveWorkoutDraftSync();
    }
  });
}

export const useActiveWorkoutStore = create<ActiveWorkoutStoreState>((set, get) => {
  const commitPatch = (patch: Partial<RuntimeActiveWorkoutState>) => {
    const current = get();
    const next = runtimeFromStore(current, patch);
    if (current.isHydrated && next.isWorkoutActive && mmkvStorageAdapter.isAvailable()) {
      try {
        scheduleDraftSave(runtimeStateToDraft(next), 400);
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
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      pendingDraftToSave = null;
      const runtime = draft ? draftToRuntimeState(draft) : initialRuntimeState;
      set({ ...runtime, isHydrated: true, persistenceError: null });
    },
    beginWorkout: (state) => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      pendingDraftToSave = null;
      const next: RuntimeActiveWorkoutState = { ...state, isWorkoutActive: true };
      if (mmkvStorageAdapter.isAvailable()) {
        saveActiveWorkoutDraft(runtimeStateToDraft(next));
      }
      set({ ...next, isHydrated: true, persistenceError: null });
    },
    endWorkout: () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      pendingDraftToSave = null;
      if (mmkvStorageAdapter.isAvailable()) {
        clearActiveWorkoutDraft();
      }
      set({ ...initialRuntimeState, startTime: new Date(), isHydrated: true, persistenceError: null });
    },
    setWorkoutName: (value) => commitPatch({ workoutName: resolveAction(value, get().workoutName) }),
    setStartTime: (value) => commitPatch({ startTime: resolveAction(value, get().startTime) }),
    setWorkoutExercises: (value) => commitPatch({ workoutExercises: resolveAction(value, get().workoutExercises) }),
    setWorkoutModalVisible: (value) => {
      const nextVisible = resolveAction(value, get().isWorkoutModalVisible);
      set({ isWorkoutModalVisible: nextVisible });
    },
    setActiveWorkoutComment: (value) => commitPatch({ activeWorkoutComment: resolveAction(value, get().activeWorkoutComment) }),
    setEditingSessionId: (value) => commitPatch({ editingSessionId: resolveAction(value, get().editingSessionId) }),
  };
});
