// src/storage/contracts/types.ts
// Domain contracts and schemas for StrongerN Zero-Loss Persistence architecture.

export type SetCategoryV2 = 'W' | 'S' | 'D' | 'F';

export interface LegacyAppDataV1 {
  user?: {
    name?: string;
    totalWorkouts?: number;
    isPro?: boolean;
    avatarUri?: string;
  };
  sessionsList?: any[];
  templatesList?: any[];
  exercisesList?: any[];
  primaryMetricsList?: any[];
  bodyPartMetricsList?: any[];
  isAutoTimerEnabled?: boolean;
  googleUser?: {
    email?: string;
    name?: string;
    avatarUri?: string;
    fileId?: string;
  } | null;
  animationSpeed?: number;
  lastSynced?: string | null;
  foldersList?: string[];
  activeProgramId?: string | null;
  programStartDate?: string | null;
  isHealthSyncEnabled?: boolean;
  isLiveHeartRateEnabled?: boolean;
  isProgramsEnabled?: boolean;
  isHistoryEnabled?: boolean;
  isMusclesEnabled?: boolean;
  soundSetCompleted?: string;
  soundWorkoutFinished?: string;
  soundTimerCompleted?: string;
  customSounds?: Array<{ id: string; name: string; uri: string }>;
  soundVolume?: number;
  defaultRestDuration?: number;
  showAchievementBadges?: boolean;
  showSummaryWidgets?: boolean;
  showWeeklyTonnage?: boolean;
  showWorkoutsChart?: boolean;
  showHighlights?: boolean;
  showHypertrophyGoal?: boolean;
  enableRoutineFolders?: boolean;
  isDeveloperModeEnabled?: boolean;
  isProgressiveOverloadEnabled?: boolean;
  isAutoFinishSetEnabled?: boolean;
  isRpeMode?: boolean;
  appTheme?: string;
  customAccentColor?: string;
}

export interface LegacyActiveWorkoutExerciseV1 {
  id?: string;
  name: string;
  variation?: string;
  superSetGroupId?: string;
  note?: string;
  showNote?: boolean;
  isNoteLocked?: boolean;
  autoTimer?: number;
  setsDetails?: any[];
  sets?: number | any[];
}

export interface LegacyActiveWorkoutV1 {
  isWorkoutActive?: boolean;
  workoutName?: string;
  startTime?: string | number;
  comment?: string;
  isWorkoutModalVisible?: boolean;
  workoutExercises?: LegacyActiveWorkoutExerciseV1[];
}

export interface SetLogV2 {
  id: string;
  position: number;
  category: SetCategoryV2;
  completed: boolean;
  weightMilliKg: number;
  reps: number;
  rpeTenths: number | null;
  isUnilateral: boolean;
  leftWeightMilliKg: number | null;
  leftReps: number | null;
  rightWeightMilliKg: number | null;
  rightReps: number | null;
}

export interface SessionExerciseV2 {
  id: string;
  sessionId: string;
  exerciseId: string | null;
  nameSnapshot: string;
  nameNorm: string;
  variationKey: string; // empty string for base variation
  position: number;
  supersetGroupId: string | null;
  note: string | null;
  sets: SetLogV2[];
}

export interface WorkoutSessionV2 {
  id: string;
  title: string;
  titleNorm: string;
  startedAtMs: number;
  endedAtMs: number | null;
  durationSec: number;
  comment: string | null;
  totalVolumeMilliKg: number;
  prs: number;
  createdAtMs: number;
  updatedAtMs: number;
  revision: number;
  deletedAtMs: number | null;
  exercises: SessionExerciseV2[];
}

export interface ActiveSetDraftV2 {
  id: string;
  category: SetCategoryV2;
  completed: boolean;
  weightInput: string;
  repsInput: string;
  rpeInput: string;
  isUnilateral: boolean;
  leftWeightInput: string;
  leftRepsInput: string;
  rightWeightInput: string;
  rightRepsInput: string;
  suggestedWeight: string;
  suggestedReps: string;
  suggestedLeftWeight: string;
  suggestedLeftReps: string;
  suggestedRightWeight: string;
  suggestedRightReps: string;
}

export interface ActiveExerciseDraftV2 {
  id: string;
  exerciseId: string | null;
  name: string;
  variationKey: string;
  supersetGroupId: string | null;
  note: string;
  showNote: boolean;
  isNoteLocked: boolean;
  autoTimer: number | null;
  sets: ActiveSetDraftV2[];
}

export interface ActiveWorkoutDraftV2 {
  schemaVersion: number; // 2
  draftId: string;
  revision: number;
  writtenAtMs: number;
  payloadChecksum: string;
  isWorkoutActive: boolean;
  workoutName: string;
  startedAtMs: number | null;
  comment: string;
  isWorkoutModalVisible: boolean;
  editingSessionId: string | null;
  restTimerDeadlineMs: number | null;
  restTimerDurationSec: number | null;
  exercises: ActiveExerciseDraftV2[];
}

export interface MigrationState {
  status: 'unstarted' | 'in_progress' | 'verified' | 'failed';
  version: number;
  startedAtMs: number | null;
  completedAtMs: number | null;
  sourceFingerprint: string;
  runId: string;
  error: string | null;
}

export interface FinishJournal {
  operationId: string;
  draftRevision: number;
  sessionId: string;
  timestampMs: number;
  status: 'pending' | 'committed' | 'failed';
  error: string | null;
}

export interface BackupManifestV3 {
  schemaVersion: 3;
  appVersion: string;
  exportedAtMs: number;
  deviceId: string;
  checksum: string;
  counts: {
    sessions: number;
    templates: number;
    exercises: number;
    metrics: number;
  };
  payload: {
    user: any;
    sessions: WorkoutSessionV2[];
    templates: any[];
    exercises: any[];
    metrics: any[];
    settings: any;
    activeDraft?: ActiveWorkoutDraftV2 | null;
  };
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type IdGenerator = (prefix: string, seed?: string | number) => string;
