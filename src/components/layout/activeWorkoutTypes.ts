import { ExerciseSet } from '../../data/mockData';

export interface SetSuggestion {
  weight: string;
  reps: string;
  leftWeight?: string;
  leftReps?: string;
  rightWeight?: string;
  rightReps?: string;
  sourceTier?: number;
  sampleSize?: number;
  confidence?: 'none' | 'low' | 'medium' | 'high';
}

export interface SetRecord {
  id:        string;
  weight:    string;
  reps:      string;
  completed: boolean;
  rpe?:      string;
  category?: 'W' | 'S' | 'D' | 'F';
  isUnilateral?:   boolean;
  leftWeight?:     string;
  leftReps?:       string;
  rightWeight?:    string;
  rightReps?:      string;
  suggestedWeight?: string;
  suggestedReps?: string;
  suggestedLeftWeight?: string;
  suggestedLeftReps?: string;
  suggestedRightWeight?: string;
  suggestedRightReps?: string;
}

export interface ActiveExercise {
  id: string;
  name: string;
  sets: SetRecord[];
  superSetGroupId?: string;
  autoTimer?: number;
  variation?: string;
  note?: string;
  showNote?: boolean;
  isNoteLocked?: boolean;
  useRoutineTargets?: boolean;
}

export interface ActiveWorkoutModalProps {
  visible:            boolean;
  workoutName:        string;
  startTime:          Date;
  exercises:          ExerciseSet[];
  isAutoTimerEnabled: boolean;
  onClose:            () => void;
  onFinish:           (summary: { totalVolume: number; totalSets: number; durationMin: number; comment?: string }) => void;
  onDiscard:          () => void;
  exerciseLibrary?:   any[];
  onUpdateActiveExercises?: (exercises: any[]) => void;
  onUpdateExerciseNotes?: (exerciseId: string, notes?: string) => void;
  onUpdateExerciseInsightsNotes?: (exerciseId: string, insightsNotes?: string) => void;
  onUpdateExerciseVariations?: (id: string, variations: string[]) => void;
  onAddCustomExercise?:   (name: string, muscleGroup: string, equipment?: string, isUnilateral?: boolean) => any;
  isLiveHeartRateEnabled?: boolean;
  onUpdateExercise?: (id: string, name: string, muscleGroup: string, equipment: string, isUnilateral: boolean) => void;

  defaultRestDuration?: number;
  onRenameWorkout?: (name: string) => void;
  sessions?:          any[];
  isProgressiveOverloadEnabled?: boolean;
  isAutoFinishSetEnabled?: boolean;

  isRpeMode?: boolean;
  exerciseNameLanguage?: 'en' | 'he';
  isEditing?:         boolean;
  /** When editing/resuming, the original session's duration in minutes */
  previousDurationMin?: number;
  /** When editing, the session comment (user's workout note) */
  editingComment?: string;
  /** Callback to save/update the workout comment */
  onUpdateComment?: (comment: string) => void;
  onUpdateStartTime?: (time: Date) => void;
  onUpdateDefaultRestDuration?: (durationSec: number) => void;
  isPlateCalculatorEnabled?: boolean;
  isKeyboardDismissOnNextEnabled?: boolean;
}
