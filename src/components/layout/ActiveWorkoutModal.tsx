// components/layout/ActiveWorkoutModal.tsx
// Premium full-featured active workout tracking screen (Layout Optimized)
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
  Vibration,
  LayoutAnimation,
  UIManager,
  AppState,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence, runOnJS, Easing, cancelAnimation, withDelay } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as RN from 'react-native';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../../theme';
import { ExerciseSet } from '../../data/mockData';
import IconButton from '../ui/IconButton';
import { CustomWorkoutKeyboard } from '../ui/CustomWorkoutKeyboard';
import { playSetCheckedSound, playTimerCompletedSound, playWorkoutCompletedSound, playSatisfyingClickFinishSet, playSatisfyingClickStopTimer, playUncheckSetSound } from '../../utils/soundPlayer';
import AddExerciseScreen from '../../screens/AddExerciseScreen';
import RestTimerRuler from '../ui/RestTimerRuler';
import Card from '../ui/Card';
import { SwipeableRow as SharedSwipeableRow } from './SwipeableRow';

const EMPTY_ARRAY: any[] = [];
const EMPTY_OBJECT: Record<string, any> = {};

interface SetRecord {
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

interface ActiveExercise {
  id: string;
  name: string;
  sets: SetRecord[];
  superSetGroupId?: string;
  autoTimer?: number;
}

interface ActiveWorkoutModalProps {
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
  onAddCustomExercise?: (name: string, muscleGroup: string, equipment?: string) => any;
  isLiveHeartRateEnabled?: boolean;
  isPlateCalculatorEnabled?: boolean;
  defaultRestDuration?: number;
  onRenameWorkout?: (name: string) => void;
  sessions?:          any[];
  isProgressiveOverloadEnabled?: boolean;
  isAutoFinishSetEnabled?: boolean;
  isKeyboardDismissOnNextEnabled?: boolean;
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
}

function formatElapsed(startTime: Date, offsetSeconds: number = 0): string {
  const sessionSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const totalSec = Math.max(0, sessionSec + offsetSeconds);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  
  const secStr = sec.toString().padStart(2, '0');
  if (h > 0) {
    const minStr = min.toString().padStart(2, '0');
    return `${h}:${minStr}:${secStr}`;
  } else {
    return `${min}:${secStr}`;
  }
}

const AnimatedCheckmark: React.FC<{ completed: boolean }> = ({ completed }) => {
  const scale = useSharedValue(completed ? 1 : 0);
  const opacity = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(completed ? 1 : 0, { damping: 15, stiffness: 180 });
    opacity.value = withTiming(completed ? 1 : 0, { duration: 120 });
  }, [completed]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={checkStyle}>
      <Ionicons name="checkmark" size={14} color="#0D0F14" />
    </Animated.View>
  );
};

const SwipeableRow = SharedSwipeableRow;

interface SetSuggestion {
  weight: string;
  reps: string;
  leftWeight?: string;
  leftReps?: string;
  rightWeight?: string;
  rightReps?: string;
}

const getProgressiveOverloadSuggestionForSet = (
  exName: string,
  setIdx: number,
  sessions: any[],
  templateSet?: any
): SetSuggestion => {
  const matchingSessions = (sessions || [])
    .reduce<any[]>((acc, s) => {
      if (s.exercises) {
        const ex = s.exercises.find((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase());
        if (ex) {
          acc.push({ datetime: s.datetime, ex });
        }
      }
      return acc;
    }, [])
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  if (matchingSessions.length === 0) {
    return {
      weight: templateSet?.weight?.toString() || '60',
      reps: templateSet?.reps?.toString() || '10',
      leftWeight: templateSet?.leftWeight?.toString() || templateSet?.weight?.toString() || '60',
      leftReps: templateSet?.leftReps?.toString() || templateSet?.reps?.toString() || '10',
      rightWeight: templateSet?.rightWeight?.toString() || templateSet?.weight?.toString() || '60',
      rightReps: templateSet?.rightReps?.toString() || templateSet?.reps?.toString() || '10',
    };
  }

  // Build history of this specific set index across sessions (oldest to newest)
  const history: any[] = [];
  for (const item of matchingSessions) {
    const setsDetails = item.ex.setsDetails || [];
    const s = setsDetails[setIdx] || setsDetails[setsDetails.length - 1];
    if (s) {
      history.push(s);
    }
  }

  const lastSet = history[history.length - 1];
  if (!lastSet) {
    return {
      weight: templateSet?.weight?.toString() || '60',
      reps: templateSet?.reps?.toString() || '10',
      leftWeight: templateSet?.leftWeight?.toString() || templateSet?.weight?.toString() || '60',
      leftReps: templateSet?.leftReps?.toString() || templateSet?.reps?.toString() || '10',
      rightWeight: templateSet?.rightWeight?.toString() || templateSet?.weight?.toString() || '60',
      rightReps: templateSet?.rightReps?.toString() || templateSet?.reps?.toString() || '10',
    };
  }

  const isCompound = /bench|press|squat|deadlift|row|overhead|pullup|pull-up|dip|chinup|chin-up/i.test(exName);
  const isIsolation = /curl|extension|fly|raise|crossover|pushdown|lateral|kickback/i.test(exName);
  const targetReps = isCompound ? 8 : (isIsolation ? 12 : 10);

  // Unilateral logic
  if (lastSet.isUnilateral || templateSet?.isUnilateral) {
    const lw = parseFloat(lastSet.leftWeight ?? lastSet.weight ?? '0') || 0;
    const lr = parseInt(lastSet.leftReps ?? lastSet.reps ?? '0', 10) || 0;
    const rw = parseFloat(lastSet.rightWeight ?? lastSet.weight ?? '0') || 0;
    const rr = parseInt(lastSet.rightReps ?? lastSet.reps ?? '0', 10) || 0;

    // Calculate historical adaptation rate (how many sessions it takes to increase reps)
    let totalIncreases = 0;
    let totalSessionsSpent = 0;
    let currentRepCount = -1;
    let currentRepSessions = 0;

    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      const hLr = parseInt(h.leftReps ?? h.reps ?? '0', 10) || 0;
      const hRr = parseInt(h.rightReps ?? h.reps ?? '0', 10) || 0;
      const minR = Math.min(hLr, hRr);
      if (minR === currentRepCount) {
        currentRepSessions++;
      } else {
        if (currentRepCount !== -1 && minR > currentRepCount) {
          totalIncreases++;
          totalSessionsSpent += currentRepSessions;
        }
        currentRepCount = minR;
        currentRepSessions = 1;
      }
    }

    const avgSessionsToIncrease = totalIncreases > 0 ? (totalSessionsSpent / totalIncreases) : 2;
    const requiredSessions = Math.min(5, Math.max(1, Math.round(avgSessionsToIncrease)));

    // Calculate current weight consistency and rep consistency
    let consecutiveSessionsAtCurrentWeight = 0;
    let consecutiveSessionsAtLastRepsOrMore = 0;
    const minReps = Math.min(lr, rr);

    for (let i = history.length - 1; i >= 0; i--) {
      const hLw = parseFloat(history[i].leftWeight ?? history[i].weight ?? '0') || 0;
      const hRw = parseFloat(history[i].rightWeight ?? history[i].weight ?? '0') || 0;
      const hLr = parseInt(history[i].leftReps ?? history[i].reps ?? '0', 10) || 0;
      const hRr = parseInt(history[i].rightReps ?? history[i].reps ?? '0', 10) || 0;

      if (hLw === lw && hRw === rw) {
        consecutiveSessionsAtCurrentWeight++;
        if (Math.min(hLr, hRr) >= minReps) {
          consecutiveSessionsAtLastRepsOrMore++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (minReps >= targetReps) {
      // Met or exceeded target reps! Increase weight
      const slowProgression = consecutiveSessionsAtCurrentWeight >= requiredSessions * 3;
      const weightInc = slowProgression ? 1.0 : 1.25; // Smaller jump for slow progressors
      return {
        weight: (lw + weightInc).toString(),
        reps: (targetReps - 2).toString(),
        leftWeight: (lw + weightInc).toString(),
        leftReps: (targetReps - 2).toString(),
        rightWeight: (rw + weightInc).toString(),
        rightReps: (targetReps - 2).toString(),
      };
    } else {
      // Below target reps: increase reps or consolidate
      if (consecutiveSessionsAtLastRepsOrMore < requiredSessions) {
        // Consolidate current performance
        return {
          weight: lw.toString(),
          reps: minReps.toString(),
          leftWeight: lw.toString(),
          leftReps: lr.toString(),
          rightWeight: rw.toString(),
          rightReps: rr.toString(),
        };
      } else {
        // Progress reps: focus on lifting the weaker side
        const nextLreps = lr < rr ? lr + 1 : (lr === rr ? lr + 1 : lr);
        const nextRreps = rr < lr ? rr + 1 : (lr === rr ? rr + 1 : rr);
        return {
          weight: lw.toString(),
          reps: Math.max(nextLreps, nextRreps).toString(),
          leftWeight: lw.toString(),
          leftReps: nextLreps.toString(),
          rightWeight: rw.toString(),
          rightReps: nextRreps.toString(),
        };
      }
    }
  }

  // Bilateral logic
  const w = parseFloat(lastSet.weight ?? '0') || 0;
  const r = parseInt(lastSet.reps ?? '0', 10) || 0;

  // Calculate historical adaptation rate (how many sessions it takes to increase reps)
  let totalIncreases = 0;
  let totalSessionsSpent = 0;
  let currentRepCount = -1;
  let currentRepSessions = 0;

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const hR = parseInt(h.reps ?? '0', 10) || 0;
    if (hR === currentRepCount) {
      currentRepSessions++;
    } else {
      if (currentRepCount !== -1 && hR > currentRepCount) {
        totalIncreases++;
        totalSessionsSpent += currentRepSessions;
      }
      currentRepCount = hR;
      currentRepSessions = 1;
    }
  }

  const avgSessionsToIncrease = totalIncreases > 0 ? (totalSessionsSpent / totalIncreases) : 2;
  const requiredSessions = Math.min(5, Math.max(1, Math.round(avgSessionsToIncrease)));

  // Calculate current weight consistency and rep consistency
  let consecutiveSessionsAtCurrentWeight = 0;
  let consecutiveSessionsAtLastRepsOrMore = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const hWeight = parseFloat(history[i].weight ?? '0') || 0;
    const hReps = parseInt(history[i].reps ?? '0', 10) || 0;

    if (hWeight === w) {
      consecutiveSessionsAtCurrentWeight++;
      if (hReps >= r) {
        consecutiveSessionsAtLastRepsOrMore++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (r >= targetReps) {
    // Met or exceeded target reps! Increase weight
    const slowProgression = consecutiveSessionsAtCurrentWeight >= requiredSessions * 3;
    let weightInc = 2.5;
    if (isIsolation || w < 20 || slowProgression) {
      weightInc = 1.25; // Smaller jump for isolation, light weights, or slow progressors
    }
    return {
      weight: (w + weightInc).toString(),
      reps: (targetReps - 2).toString(),
    };
  } else {
    // Below target reps: increase reps or consolidate
    if (consecutiveSessionsAtLastRepsOrMore < requiredSessions) {
      // Consolidate current reps
      return {
        weight: w.toString(),
        reps: r.toString(),
      };
    } else {
      // Progress reps
      return {
        weight: w.toString(),
        reps: (r + 1).toString(),
      };
    }
  }
};

const cancelAndScheduleRestNotification = async (duration: number) => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (duration > 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rest Timer Completed! ⏱️",
        body: "Time's up! Get ready for your next set.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: duration,
      },
    });
  }
};

const serializeState = (exercises: any[], note: string): string => {
  try {
    const serializedExs = exercises.map(ex => ({
      name: ex.name,
      sets: (ex.sets || []).map((s: any) => ({
        weight: s.weight?.toString() || '',
        reps: s.reps?.toString() || '',
        completed: !!s.completed,
        rpe: s.rpe?.toString() || '',
        category: s.category || 'S',
        isUnilateral: !!s.isUnilateral,
        leftWeight: s.leftWeight?.toString() || '',
        leftReps: s.leftReps?.toString() || '',
        rightWeight: s.rightWeight?.toString() || '',
        rightReps: s.rightReps?.toString() || '',
      }))
    }));
    return JSON.stringify({ note, exercises: serializedExs });
  } catch (e) {
    return '';
  }
};

// Contiguous supersets verification & dissolution helper
function sanitizeSuperSets<T extends { superSetGroupId?: string }>(items: T[]): T[] {
  const seenGroups = new Set<string>();
  let lastGroupId: string | undefined = undefined;
  
  const result = items.map((item, idx) => {
    const gid = item.superSetGroupId;
    if (!gid) {
      lastGroupId = undefined;
      return item;
    }
    
    // If we've seen this group ID before, but it's not contiguous with the last one, split it!
    if (seenGroups.has(gid) && lastGroupId !== gid) {
      const newGid = `ss-split-${Date.now()}-${idx}-${Math.random()}`;
      lastGroupId = newGid;
      return { ...item, superSetGroupId: newGid };
    }
    
    seenGroups.add(gid);
    lastGroupId = gid;
    return item;
  });
  
  // Dissolve groups containing < 2 exercises
  const groupCounts: Record<string, number> = {};
  result.forEach(item => {
    if (item.superSetGroupId) {
      groupCounts[item.superSetGroupId] = (groupCounts[item.superSetGroupId] || 0) + 1;
    }
  });
  
  return result.map(item => {
    if (item.superSetGroupId && groupCounts[item.superSetGroupId] < 2) {
      return { ...item, superSetGroupId: undefined };
    }
    return item;
  });
}

const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  visible,
  workoutName,
  startTime,
  exercises,
  isAutoTimerEnabled,
  onClose,
  onFinish,
  onDiscard,
  exerciseLibrary = EMPTY_ARRAY,
  onUpdateActiveExercises,
  onUpdateExerciseNotes,
  onAddCustomExercise,
  isLiveHeartRateEnabled = false,
  isPlateCalculatorEnabled = true,
  defaultRestDuration = 90,
  onRenameWorkout,
  sessions = EMPTY_ARRAY,
  isProgressiveOverloadEnabled = false,
  isAutoFinishSetEnabled = true,
  isKeyboardDismissOnNextEnabled = true,
  isRpeMode = true,
  exerciseNameLanguage,
  isEditing = false,
  previousDurationMin = 0,
  editingComment,
  onUpdateComment,
  onUpdateStartTime,
  onUpdateDefaultRestDuration,
}) => {
  const insets = useSafeAreaInsets();
  // Track the actual resume/edit start time (when THIS session started, not the original workout)
  const resumeStartTime = useRef(isEditing ? new Date() : (startTime || new Date()));
  // Offset in seconds from previous session duration (for edit/resume)
  const accumulatedOffsetSeconds = useRef((previousDurationMin || 0) * 60);
  const initialStateRef = useRef<{ exercises: string; note: string }>({ exercises: '', note: '' });
  const wasInitializedRef = useRef(false);
  const [elapsed, setElapsed] = useState(() => formatElapsed(resumeStartTime.current, accumulatedOffsetSeconds.current));
  // Workout menu state
  const [isWorkoutMenuVisible, setIsWorkoutMenuVisible] = useState(false);
  const [workoutNote, setWorkoutNote] = useState(editingComment || '');
  const [isWorkoutNoteModalVisible, setIsWorkoutNoteModalVisible] = useState(false);
  const [isStartTimePickerVisible, setIsStartTimePickerVisible] = useState(false);
  const [editedStartTimeText, setEditedStartTimeText] = useState('');
  const [isDefaultTimerPickerVisible, setIsDefaultTimerPickerVisible] = useState(false);
  const [localDefaultRest, setLocalDefaultRest] = useState(defaultRestDuration);
  const [customDefaultTimerValue, setCustomDefaultTimerValue] = useState('');
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const hasSyncedPropsRef = useRef(false);
  const [heartRate, setHeartRate] = useState(132);

  const [localWorkoutName, setLocalWorkoutName] = useState(workoutName);
  const [activeInput, setActiveInput] = useState<{
    exIdx: number;
    setIdx: number;
    fieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
    focusTime?: number;
  } | null>(null);
  const [tempInputValue, setTempInputValue] = useState('');
  const tempInputValueRef = useRef('');
  const activeInputRef = useRef<typeof activeInput>(null);
  useEffect(() => {
    activeInputRef.current = activeInput;
  }, [activeInput]);

  const inputRefs = useRef<{ [key: string]: any }>({});

  const [showSecondsOnly, setShowSecondsOnly] = useState(false);
  const animatedTimerStyle = useAnimatedStyle(() => ({
    opacity: 1,
    transform: [{ scale: 1 }],
  }));

  const toggleTimerFormat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowSecondsOnly(prev => !prev);
  }, []);

  useEffect(() => {
    if (visible) {
      setLocalWorkoutName(workoutName);
    }
  }, [visible, workoutName]);

  // Live heart rate telemetry tick simulation
  useEffect(() => {
    if (!visible || !isLiveHeartRateEnabled) return;
    const id = setInterval(() => {
      if (isRulerDragging.current) return;
      setHeartRate(prev => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = prev + delta;
        return Math.max(105, Math.min(160, next));
      });
    }, 1500);
    return () => clearInterval(id);
  }, [visible, isLiveHeartRateEnabled]);

  // Auto rest timer countdown states
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const restTimerEndTarget = useRef<number | null>(null);
  const [isTimerSubMenuVisible, setIsTimerSubMenuVisible] = useState(false);
  const isRulerDragging = useRef(false);

  // Exercise library selector modal states
  const [isLibraryVisible, setIsLibraryVisible] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeExerciseMenuIndex, setActiveExerciseMenuIndex] = useState<number | null>(null);
  const [isExMenuVisible, setIsExMenuVisible] = useState(false);
  const [isTimerPickerVisible, setIsTimerPickerVisible] = useState(false);
  const [customTimerValue, setCustomTimerValue] = useState('90');
  const [isReplaceMode, setIsReplaceMode] = useState(false);

  // Bottom Sheet Swipe gesture translation and PanResponders
  const sheetTranslateY = useRef(new RN.Animated.Value(0)).current;

  // PanResponder for Exercise Menu bottom sheet
  const exMenuPanResponder = useRef(
    RN.PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only drag if it is downward vertical movement
        return gestureState.dy > 8 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          RN.Animated.timing(sheetTranslateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setIsExMenuVisible(false);
            sheetTranslateY.setValue(0);
          });
        } else {
          RN.Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        RN.Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // PanResponder for Timer Picker bottom sheet
  const timerPickerPanResponder = useRef(
    RN.PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 8 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          RN.Animated.timing(sheetTranslateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setIsTimerPickerVisible(false);
            sheetTranslateY.setValue(0);
          });
        } else {
          RN.Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        RN.Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // PanResponder for Workout Menu bottom sheet
  const workoutMenuPanResponder = useRef(
    RN.PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 8 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          RN.Animated.timing(sheetTranslateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setIsWorkoutMenuVisible(false);
            sheetTranslateY.setValue(0);
          });
        } else {
          RN.Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        RN.Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Custom exercise creation inside library picker
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('Chest');
  const [customEquipment, setCustomEquipment] = useState('Barbell');

  // Drag-and-drop reorder state for exercises
  const exDragY = useSharedValue(0);
  const exDragIdx     = useRef(-1);
  const exHoverIdx    = useRef(-1);
  const [exActiveKey, setExActiveKey] = useState<string | null>(null);
  const exItemLayouts = useRef<{ [key: string]: { y: number; height: number } }>({});

  // Static refs for tracking target exercise details
  const exSlotYRef    = useRef<number[]>([]);
  const exInitialYRef = useRef<number>(0);
  const exIndicesRef  = useRef<{ [id: string]: number }>({});
  const exPanRespondersRef = useRef<{ [id: string]: any }>({});

  const activeExercisesRef = useRef(activeExercises);
  useEffect(() => {
    activeExercisesRef.current = activeExercises;
  }, [activeExercises]);

  // Plate calculator states
  const [isPlateCalcVisible, setIsPlateCalcVisible] = useState(false);
  const [plateCalcTargetWeight, setPlateCalcTargetWeight] = useState('60');
  const [barWeight, setBarWeight] = useState<20 | 15>(20);

  // Exercise notes states
  const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  const calculatedPlates = useMemo(() => {
    const target = parseFloat(plateCalcTargetWeight) || 0;
    if (target <= barWeight) return [];
    
    let sideWeight = (target - barWeight) / 2;
    const availablePlates = [
      { size: 25, color: '#EF4444', textColor: '#FFFFFF' },
      { size: 20, color: '#3B82F6', textColor: '#FFFFFF' },
      { size: 15, color: '#FBBF24', textColor: '#0D0F14' },
      { size: 10, color: '#10B981', textColor: '#FFFFFF' },
      { size: 5,  color: '#EEF1F6', textColor: '#0D0F14' },
      { size: 2.5, color: '#374151', textColor: '#FFFFFF' },
      { size: 1.25, color: '#6B7280', textColor: '#FFFFFF' },
    ];
    
    const result: typeof availablePlates = [];
    
    for (const plate of availablePlates) {
      while (sideWeight >= plate.size) {
        result.push(plate);
        sideWeight -= plate.size;
        if (sideWeight < 0.01) break;
      }
    }
    return result;
  }, [plateCalcTargetWeight, barWeight]);

  // Map each unique superSetGroupId to a dynamic color from theme
  const superSetColors = useMemo(() => {
    const colorsList = [
      '#4F8EF7', // Electric Blue
      '#38BDF8', // Neon Sky Blue
      '#6366F1', // Sporty Indigo
      '#22D97A', // Emerald Green
    ];
    const map: Record<string, string> = {};
    let colorIdx = 0;
    activeExercises.forEach(ex => {
      if (ex.superSetGroupId && !map[ex.superSetGroupId]) {
        map[ex.superSetGroupId] = colorsList[colorIdx % colorsList.length];
        colorIdx++;
      }
    });
    return map;
  }, [activeExercises]);

  const lastStartTimeRef = useRef<string | null>(null);
  // Inline render-phase adjustment: reset workout/timer state when a new workout session starts
  const prevStartKeyForResetRef = useRef<string | null>(null);
  const currentStartKey = startTime.toISOString();
  if (visible && prevStartKeyForResetRef.current !== currentStartKey && prevStartKeyForResetRef.current !== null) {
    prevStartKeyForResetRef.current = currentStartKey;
    setIsTimerActive(false);
  } else if (prevStartKeyForResetRef.current === null) {
    prevStartKeyForResetRef.current = currentStartKey;
  }

  // Sync props to state when modal becomes visible
  useEffect(() => {
    if (visible) {
      const startKey = startTime.toISOString();
      const isNewWorkout = lastStartTimeRef.current !== startKey;

      if (!wasInitializedRef.current || isNewWorkout) {
        lastStartTimeRef.current = startKey;
        wasInitializedRef.current = true;

        // Reset timer refs and note state on a fresh track/edit session start
        resumeStartTime.current = isEditing ? new Date() : (startTime || new Date());
        accumulatedOffsetSeconds.current = (previousDurationMin || 0) * 60;
        setElapsed(formatElapsed(resumeStartTime.current, accumulatedOffsetSeconds.current));
        setWorkoutNote(editingComment || '');

        const initial = exercises.map((ex: any, exIdx) => {
          const setsCount = typeof ex.sets === 'number' ? ex.sets : (Array.isArray(ex.sets) ? ex.sets.length : 3);
          
          // Reconstruct SetRecord from setsDetails if present
          const existingDetails = (ex as any).setsDetails;
          const isSetsArray = Array.isArray(ex.sets);
          
          if (existingDetails && existingDetails.length > 0) {
            return {
              id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
              name: ex.name,
              sets: existingDetails.map((s: any, sIdx: number) => {
                const isUnilateral = s.isUnilateral || false;
                const completed = s.completed || false;
                return {
                  id:           `set-${exIdx}-${sIdx}-${Date.now()}`,
                  weight:       completed ? (s.weight?.toString() || '') : '',
                  reps:         completed ? (s.reps?.toString() || '') : '',
                  completed:    completed,
                  rpe:          s.rpe ? s.rpe.toString() : '',
                  category:     (s.category || 'S') as 'W' | 'S' | 'D' | 'F',
                  isUnilateral: isUnilateral,
                  leftWeight:   isUnilateral ? (completed ? (s.leftWeight?.toString() || '') : '') : undefined,
                  leftReps:     isUnilateral ? (completed ? (s.leftReps?.toString() || '') : '') : undefined,
                  rightWeight:  isUnilateral ? (completed ? (s.rightWeight?.toString() || '') : '') : undefined,
                  rightReps:    isUnilateral ? (completed ? (s.rightReps?.toString() || '') : '') : undefined,
                  suggestedWeight: s.suggestedWeight?.toString() || s.weight?.toString() || '60',
                  suggestedReps: s.suggestedReps?.toString() || s.reps?.toString() || '10',
                  suggestedLeftWeight: isUnilateral ? (s.suggestedLeftWeight?.toString() || s.leftWeight?.toString() || s.weight?.toString() || '60') : undefined,
                  suggestedLeftReps: isUnilateral ? (s.suggestedLeftReps?.toString() || s.leftReps?.toString() || s.reps?.toString() || '10') : undefined,
                  suggestedRightWeight: isUnilateral ? (s.suggestedRightWeight?.toString() || s.rightWeight?.toString() || s.weight?.toString() || '60') : undefined,
                  suggestedRightReps: isUnilateral ? (s.suggestedRightReps?.toString() || s.rightReps?.toString() || s.reps?.toString() || '10') : undefined,
                };
              }),
              superSetGroupId: (ex as any).superSetGroupId,
            };
          } else if (isSetsArray && ex.sets.length > 0) {
            return {
              id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
              name: ex.name,
              sets: ex.sets.map((s: any, sIdx: number) => {
                const isUnilateral = s.isUnilateral || false;
                const completed = s.completed || false;
                let suggested: SetSuggestion = {
                  weight: s.weight?.toString() || '60',
                  reps: s.reps?.toString() || '10',
                  leftWeight: s.leftWeight?.toString() || s.weight?.toString() || '60',
                  leftReps: s.leftReps?.toString() || s.reps?.toString() || '10',
                  rightWeight: s.rightWeight?.toString() || s.weight?.toString() || '60',
                  rightReps: s.rightReps?.toString() || s.reps?.toString() || '10',
                };
                if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
                  suggested = getProgressiveOverloadSuggestionForSet(ex.name, sIdx, sessions, s);
                }
                return {
                  id:        s.id || `set-${exIdx}-${sIdx}-${Date.now()}`,
                  weight:    completed ? suggested.weight : '',
                  reps:      completed ? suggested.reps : '',
                  completed: completed,
                  rpe:       s.rpe ? s.rpe.toString() : '',
                  category:  (s.category || 'S') as 'W' | 'S' | 'D' | 'F',
                  isUnilateral: isUnilateral,
                  leftWeight:   isUnilateral ? (completed ? suggested.leftWeight : '') : undefined,
                  leftReps:     isUnilateral ? (completed ? suggested.leftReps : '') : undefined,
                  rightWeight:  isUnilateral ? (completed ? suggested.rightWeight : '') : undefined,
                  rightReps:    isUnilateral ? (completed ? suggested.rightReps : '') : undefined,
                  suggestedWeight: suggested.weight,
                  suggestedReps: suggested.reps,
                  suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
                  suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
                  suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
                  suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
                };
              }),
              superSetGroupId: (ex as any).superSetGroupId,
            };
          }
 
           return {
             id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
             name: ex.name,
             sets: Array.from({ length: setsCount }).map((_, setIdx) => {
               const isUnilateral = (ex as any).isUnilateral || false;
               let suggested: SetSuggestion = {
                 weight: ex.bestWeight ? ex.bestWeight.toString() : '60',
                 reps: ex.bestReps ? ex.bestReps.toString() : '10',
                 leftWeight: ex.bestWeight ? ex.bestWeight.toString() : '60',
                 leftReps: ex.bestReps ? ex.bestReps.toString() : '10',
                 rightWeight: ex.bestWeight ? ex.bestWeight.toString() : '60',
                 rightReps: ex.bestReps ? ex.bestReps.toString() : '10',
               };
               if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
                 suggested = getProgressiveOverloadSuggestionForSet(ex.name, setIdx, sessions, {
                   weight: suggested.weight,
                   reps: suggested.reps,
                   isUnilateral
                 });
               }
               return {
                 id:        `set-${exIdx}-${setIdx}-${Date.now()}`,
                 weight:    '',
                 reps:      '',
                 completed: false,
                 rpe:       '',
                 category:  'S' as const,
                 isUnilateral: isUnilateral,
                 leftWeight:   isUnilateral ? '' : undefined,
                 leftReps:     isUnilateral ? '' : undefined,
                 rightWeight:  isUnilateral ? '' : undefined,
                 rightReps:    isUnilateral ? '' : undefined,
                 suggestedWeight: suggested.weight,
                 suggestedReps: suggested.reps,
                 suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
                 suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
                 suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
                 suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
               };
             }),
            superSetGroupId: (ex as any).superSetGroupId,
          };
        });
        setActiveExercises(initial);

        // Capture initial state for change detection (to check if user made changes)
        initialStateRef.current = {
          exercises: serializeState(initial, editingComment || ''),
          note: editingComment || ''
        };

        hasSyncedPropsRef.current = true;
      }
    }
  }, [visible, startTime, exercises, previousDurationMin, editingComment]);

  // Sync active exercises back to parent App state so they are stored
  useEffect(() => {
    if (!hasSyncedPropsRef.current) return;
    if (onUpdateActiveExercises) {
      const mapped = activeExercises.map(ex => {
        const completedSets = ex.sets.filter(s => s.completed);
        const allWeights = completedSets.flatMap(s => {
          if (s.isUnilateral) {
            return [parseFloat(s.leftWeight || s.weight) || 0, parseFloat(s.rightWeight || s.weight) || 0];
          }
          return [parseFloat(s.weight) || 0];
        });
        const allReps = completedSets.flatMap(s => {
          if (s.isUnilateral) {
            return [parseInt(s.leftReps || s.reps, 10) || 0, parseInt(s.rightReps || s.reps, 10) || 0];
          }
          return [parseInt(s.reps, 10) || 0];
        });
        return {
          name: ex.name,
          sets: completedSets.length,
          bestWeight: allWeights.length > 0 ? Math.max(...allWeights, 0) : 0,
          bestReps: allReps.length > 0 ? Math.max(...allReps, 0) : 0,
          superSetGroupId: ex.superSetGroupId,
          setsDetails: ex.sets.map(s => ({
            weight: parseFloat(s.weight) || 0,
            reps: parseInt(s.reps, 10) || 0,
            completed: s.completed,
            rpe: s.rpe ? parseFloat(s.rpe) : undefined,
            category: s.category || 'S',
            isUnilateral: s.isUnilateral || false,
            leftWeight: s.leftWeight ? parseFloat(s.leftWeight) : undefined,
            leftReps: s.leftReps ? parseInt(s.leftReps, 10) : undefined,
            rightWeight: s.rightWeight ? parseFloat(s.rightWeight) : undefined,
            rightReps: s.rightReps ? parseInt(s.rightReps, 10) : undefined,
          })),
        };
      });
      onUpdateActiveExercises(mapped);
    }
  }, [activeExercises]);

  // Live timer interval
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      if (isRulerDragging.current) return;
      setElapsed(formatElapsed(resumeStartTime.current, accumulatedOffsetSeconds.current));
    }, 1000);
    return () => clearInterval(id);
  }, [visible]);

  // Configure notifications
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // Background and Foreground Time Sync + Persistent Notification
  useEffect(() => {
    let backgroundNotificationId: string | null = null;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // Sync total elapsed
        setElapsed(formatElapsed(resumeStartTime.current, accumulatedOffsetSeconds.current));

        // Sync rest timer
        if (isTimerActive && restTimerEndTarget.current) {
          const now = Date.now();
          if (now >= restTimerEndTarget.current) {
            setRestTimeRemaining(0);
            setIsTimerActive(false);
            restTimerEndTarget.current = null;
          } else {
            setRestTimeRemaining(Math.ceil((restTimerEndTarget.current - now) / 1000));
          }
        }

        // Cancel background notification when returning to app
        if (backgroundNotificationId) {
          try {
            await Notifications.dismissNotificationAsync(backgroundNotificationId);
          } catch (e) {
            // Ignore errors
          }
          backgroundNotificationId = null;
        }

        // Clear all notifications in tray
        try {
          await Notifications.dismissAllNotificationsAsync();
        } catch (e) {
          // Ignore errors
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Show persistent notification when app goes to background during active workout
        if (visible) {
          const currentExerciseName = activeExercises.length > 0
            ? activeExercises[0].name
            : 'Workout in Progress';
          const elapsedStr = formatElapsed(resumeStartTime.current, accumulatedOffsetSeconds.current);

          try {
            const notifId = await Notifications.scheduleNotificationAsync({
              content: {
                title: `${localWorkoutName || 'Workout'}`,
                body: `${currentExerciseName} • ${elapsedStr}${isTimerActive ? ` • Rest: ${restTimeRemaining}s` : ''}`,
                sticky: true,
                autoDismiss: false,
                sound: false,
              },
              trigger: null, // Show immediately
            });
            backgroundNotificationId = notifId;
          } catch (e) {
            console.warn('Error showing background notification', e);
          }
        }
      }
    });
    return () => subscription.remove();
  }, [isTimerActive, startTime, visible, activeExercises, localWorkoutName, restTimeRemaining]);

  // Rest Timer Countdown Interval
  useEffect(() => {
    if (!isTimerActive || restTimeRemaining <= 0) {
      if (isTimerActive && restTimeRemaining === 0) {
        setIsTimerActive(false);
        setIsTimerSubMenuVisible(false);
        restTimerEndTarget.current = null;
      }
      return;
    }

    // Set target when timer becomes active
    if (!restTimerEndTarget.current) {
      restTimerEndTarget.current = Date.now() + restTimeRemaining * 1000;
    }

    const timerId = setInterval(() => {
      if (isRulerDragging.current) return;
      if (!restTimerEndTarget.current) return;
      const now = Date.now();
      const remaining = Math.ceil((restTimerEndTarget.current - now) / 1000);

      if (remaining <= 0) {
        setRestTimeRemaining(0);
        setIsTimerActive(false);
        setIsTimerSubMenuVisible(false);
        restTimerEndTarget.current = null;
        playTimerCompletedSound();
      } else {
        setRestTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(timerId);
  }, [isTimerActive, restTimeRemaining]);

  const adjustRestTimer = (seconds: number) => {
    if (!restTimerEndTarget.current) return;
    const now = Date.now();
    const newTarget = restTimerEndTarget.current + seconds * 1000;
    if (newTarget <= now) {
      setRestTimeRemaining(0);
      setIsTimerActive(false);
      setIsTimerSubMenuVisible(false);
      restTimerEndTarget.current = null;
      Notifications.cancelAllScheduledNotificationsAsync();
    } else {
      restTimerEndTarget.current = newTarget;
      const remaining = Math.ceil((newTarget - now) / 1000);
      setRestTimeRemaining(remaining);
      cancelAndScheduleRestNotification(remaining);
    }
  };

  const timerPulseAnim = useSharedValue(1);
  useEffect(() => {
    if (!isTimerActive) return;
    if (globalAnimation.speed === 0) {
      timerPulseAnim.value = 1;
      return;
    }
    const dur = getScaledDuration(500);
    const easing = Easing.inOut(Easing.ease);
    timerPulseAnim.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: dur, easing }),
        withTiming(1, { duration: dur, easing })
      ),
      -1,
      true
    );
    return () => { timerPulseAnim.value = 1; };
  }, [isTimerActive, globalAnimation.speed]);

  // Set completeness toggler
  const toggleSetComplete = useCallback((exIdx: number, setIdx: number) => {
    const targetSet = activeExercises[exIdx]?.sets[setIdx];
    if (!targetSet) return;
    const willBeCompleted = !targetSet.completed;

    if (willBeCompleted) {
      playSetCheckedSound();
      playSatisfyingClickFinishSet();
      if (isAutoTimerEnabled) {
        const customRest = activeExercises[exIdx]?.autoTimer;
        const duration = typeof customRest === 'number' ? customRest : defaultRestDuration;
        restTimerEndTarget.current = Date.now() + duration * 1000;
        setRestTimeRemaining(duration);
        setIsTimerActive(true);
        cancelAndScheduleRestNotification(duration);
      }
    } else {
      playUncheckSetSound();
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set, sIdx) => {
            if (sIdx !== setIdx) return set;
            let updated = { ...set, completed: willBeCompleted };
            if (willBeCompleted) {
              if (!updated.weight && (updated as any).suggestedWeight) {
                updated.weight = (updated as any).suggestedWeight;
              }
              if (!updated.reps && (updated as any).suggestedReps) {
                updated.reps = (updated as any).suggestedReps;
              }
              if (updated.isUnilateral) {
                if (!updated.leftWeight && (updated as any).suggestedLeftWeight) {
                  updated.leftWeight = (updated as any).suggestedLeftWeight;
                }
                if (!updated.leftReps && (updated as any).suggestedLeftReps) {
                  updated.leftReps = (updated as any).suggestedLeftReps;
                }
                if (!updated.rightWeight && (updated as any).suggestedRightWeight) {
                  updated.rightWeight = (updated as any).suggestedRightWeight;
                }
                if (!updated.rightReps && (updated as any).suggestedRightReps) {
                  updated.rightReps = (updated as any).suggestedRightReps;
                }
              }
            }
            return updated;
          })
        };
      });
    });
  }, [activeExercises, isAutoTimerEnabled, defaultRestDuration]);

  // Set weight/reps/rpe/category updater
  const updateSetField = useCallback((exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'rpe' | 'category' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps', value: string) => {
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set, sIdx) => {
            if (sIdx !== setIdx) return set;
            const updated = { ...set, [field]: value };
            if (field === 'weight') (updated as any).weightSuggested = false;
            else if (field === 'reps') (updated as any).repsSuggested = false;
            else if (field === 'leftWeight') (updated as any).leftWeightSuggested = false;
            else if (field === 'leftReps') (updated as any).leftRepsSuggested = false;
            else if (field === 'rightWeight') (updated as any).rightWeightSuggested = false;
            else if (field === 'rightReps') (updated as any).rightRepsSuggested = false;
            return updated;
          })
        };
      });
    });
  }, []);

  // Stable keyboard close/dismiss handler
  const handleCloseKeyboard = useCallback(() => {
    if (activeInputRef.current) {
      updateSetField(activeInputRef.current.exIdx, activeInputRef.current.setIdx, activeInputRef.current.fieldName, tempInputValueRef.current);
    }
    setActiveInput(null);
  }, [updateSetField]);

  // Stable input focus handler (must NOT be inside .map())
  const handleSetFocus = useCallback((ex: number, s: number, field: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps') => {
    // 1. Commit the active input first (using activeInput and tempInputValueRef.current)
    if (activeInputRef.current) {
      updateSetField(activeInputRef.current.exIdx, activeInputRef.current.setIdx, activeInputRef.current.fieldName, tempInputValueRef.current);
    }
    
    // 2. Set the new input value and focus
    const currentVal = activeExercisesRef.current[ex]?.sets[s]?.[field] || '';
    setTempInputValue(String(currentVal));
    tempInputValueRef.current = String(currentVal);
    
    const newInput = { exIdx: ex, setIdx: s, fieldName: field, focusTime: Date.now() };
    setActiveInput(newInput);
    activeInputRef.current = newInput;
  }, [updateSetField]);

  // Add a set
  const addSet = useCallback((exIdx: number, isUnilateral: boolean = false) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        const currentSets = ex.sets;
        const lastSet = currentSets[currentSets.length - 1];

        const sugWeight = lastSet ? (lastSet.weight || (lastSet as any).suggestedWeight || '60') : '60';
        const sugReps = lastSet ? (lastSet.reps || (lastSet as any).suggestedReps || '10') : '10';
        const sugLeftWeight = isUnilateral ? (lastSet ? (lastSet.leftWeight || (lastSet as any).suggestedLeftWeight || sugWeight) : sugWeight) : undefined;
        const sugLeftReps = isUnilateral ? (lastSet ? (lastSet.leftReps || (lastSet as any).suggestedLeftReps || sugReps) : sugReps) : undefined;
        const sugRightWeight = isUnilateral ? (lastSet ? (lastSet.rightWeight || (lastSet as any).suggestedRightWeight || sugWeight) : sugWeight) : undefined;
        const sugRightReps = isUnilateral ? (lastSet ? (lastSet.rightReps || (lastSet as any).suggestedRightReps || sugReps) : sugReps) : undefined;

        const newSet: SetRecord = {
          id:        `set-${exIdx}-${Date.now()}-${Math.random()}`,
          weight:    '',
          reps:      '',
          completed: false,
          rpe:       '',
          category:  lastSet?.category ?? 'S',
          isUnilateral: isUnilateral,
          leftWeight:   isUnilateral ? '' : undefined,
          leftReps:     isUnilateral ? '' : undefined,
          rightWeight:  isUnilateral ? '' : undefined,
          rightReps:    isUnilateral ? '' : undefined,
          suggestedWeight: sugWeight,
          suggestedReps: sugReps,
          suggestedLeftWeight: sugLeftWeight,
          suggestedLeftReps: sugLeftReps,
          suggestedRightWeight: sugRightWeight,
          suggestedRightReps: sugRightReps,
        } as any;
        return {
          ...ex,
          sets: [...currentSets, newSet]
        };
      });
    });
  }, []);

  // Delete a set
  const deleteSet = useCallback((exIdx: number, setIdx: number) => {
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.filter((_, sIdx) => sIdx !== setIdx)
        };
      });
    });
    // Shift or clear active input if it matches the deleted set/exercise
    setActiveInput(prev => {
      if (prev && prev.exIdx === exIdx) {
        if (prev.setIdx === setIdx) {
          return null; // Focused set was deleted
        } else if (prev.setIdx > setIdx) {
          return { ...prev, setIdx: prev.setIdx - 1 }; // Shift index down
        }
      }
      return prev;
    });
  }, []);

  // Handle custom keyboard "Next" button click
  const handleNextField = useCallback(() => {
    if (!activeInput) return;
    const { exIdx, setIdx, fieldName } = activeInput;

    // Commit current temp value before jumping
    updateSetField(exIdx, setIdx, fieldName, tempInputValueRef.current);

    // 1. Auto-Finish Set: When pressing "Next" inside Reps box (bilateral) or rightReps (unilateral)
    if ((fieldName === 'reps' || fieldName === 'rightReps') && isAutoFinishSetEnabled) {
      const targetSet = activeExercises[exIdx]?.sets[setIdx];
      if (targetSet && !targetSet.completed) {
        playSetCheckedSound();
        playSatisfyingClickFinishSet();
        if (isAutoTimerEnabled) {
          const customRest = activeExercises[exIdx]?.autoTimer;
          const duration = typeof customRest === 'number' ? customRest : defaultRestDuration;
          restTimerEndTarget.current = Date.now() + duration * 1000;
          setRestTimeRemaining(duration);
          setIsTimerActive(true);
          cancelAndScheduleRestNotification(duration);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveExercises(prev => {
          return prev.map((ex, eIdx) => {
            if (eIdx !== exIdx) return ex;
            return {
              ...ex,
              sets: ex.sets.map((set, sIdx) => {
                if (sIdx !== setIdx) return set;
                return { ...set, completed: true };
              })
            };
          });
        });
      }
    }

    // 2. Keyboard Dismiss on Next: When pressing "Next" inside Reps box (bilateral) or rightReps (unilateral)
    if ((fieldName === 'reps' || fieldName === 'rightReps') && isKeyboardDismissOnNextEnabled) {
      handleCloseKeyboard();
      return;
    }

    // 3. Default Jumps for bilateral sets
    if (fieldName === 'weight') {
      const nextKey = `${exIdx}-${setIdx}-reps`;
      setActiveInput({ exIdx, setIdx, fieldName: 'reps', focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 4. Default Jumps for unilateral sets: leftWeight -> leftReps -> rightWeight -> rightReps
    if (fieldName === 'leftWeight') {
      const nextKey = `${exIdx}-${setIdx}-leftReps`;
      setActiveInput({ exIdx, setIdx, fieldName: 'leftReps', focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }
    if (fieldName === 'leftReps') {
      const nextKey = `${exIdx}-${setIdx}-rightWeight`;
      setActiveInput({ exIdx, setIdx, fieldName: 'rightWeight', focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }
    if (fieldName === 'rightWeight') {
      const nextKey = `${exIdx}-${setIdx}-rightReps`;
      setActiveInput({ exIdx, setIdx, fieldName: 'rightReps', focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 5. Default Jumps: If reps (bilateral) or rightReps (unilateral), check if there's a next set in the same exercise
    const currentEx = activeExercises[exIdx];
    if (currentEx && setIdx < currentEx.sets.length - 1) {
      const nextSet = currentEx.sets[setIdx + 1];
      const nextFieldName = nextSet?.isUnilateral ? 'leftWeight' : 'weight';
      const nextKey = `${exIdx}-${setIdx + 1}-${nextFieldName}`;
      setActiveInput({ exIdx, setIdx: setIdx + 1, fieldName: nextFieldName, focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 5. Default Jumps: If last set of this exercise, check if there is a next exercise
    if (exIdx < activeExercises.length - 1) {
      const nextEx = activeExercises[exIdx + 1];
      const nextFieldName = nextEx?.sets[0]?.isUnilateral ? 'leftWeight' : 'weight';
      const nextKey = `${exIdx + 1}-0-${nextFieldName}`;
      setActiveInput({ exIdx: exIdx + 1, setIdx: 0, fieldName: nextFieldName, focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 6. Otherwise, close/blur
    handleCloseKeyboard();
  }, [activeInput, activeExercises, isAutoFinishSetEnabled, isKeyboardDismissOnNextEnabled, isAutoTimerEnabled, defaultRestDuration, updateSetField, handleCloseKeyboard]);

  // Calculate volume & sets for summary
  const handleFinishPress = () => {
    let totalVolume = 0;
    let totalSets   = 0;
    
    activeExercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) {
          if (set.isUnilateral) {
            // For unilateral sets, calculate volume from both sides
            const leftW = parseFloat(set.leftWeight || set.weight) || 0;
            const leftR = parseInt(set.leftReps || set.reps, 10) || 0;
            const rightW = parseFloat(set.rightWeight || set.weight) || 0;
            const rightR = parseInt(set.rightReps || set.reps, 10) || 0;
            totalVolume += (leftW * leftR) + (rightW * rightR);
          } else {
            const w = parseFloat(set.weight) || 0;
            const r = parseInt(set.reps, 10) || 0;
            totalVolume += w * r;
          }
          totalSets   += 1;
        }
      });
    });

    if (totalSets === 0) {
      setActiveExercises([]);
      wasInitializedRef.current = false;
      onDiscard();
      return;
    }

    const sessionSec = Math.max(0, Math.floor((Date.now() - resumeStartTime.current.getTime()) / 1000));
    
    // Check if user made any actual changes to the workout
    const currentSerialized = serializeState(activeExercises, workoutNote);
    const hasChanges = currentSerialized !== initialStateRef.current.exercises;
    
    let durationMin = 0;
    if (previousDurationMin > 0 && !hasChanges) {
      durationMin = previousDurationMin;
    } else {
      const totalDurationSec = accumulatedOffsetSeconds.current + sessionSec;
      durationMin = Math.max(1, Math.round(totalDurationSec / 60));
    }

    playWorkoutCompletedSound();
    // Store the workout note in comment if provided
    if (onUpdateComment) {
      onUpdateComment(workoutNote.trim());
    }
    
    wasInitializedRef.current = false;
    onFinish({
      totalVolume,
      totalSets,
      durationMin,
      comment: workoutNote.trim(),
    });
  };

  const handleDiscardPress = () => {
    let completedSetsCount = 0;
    activeExercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) completedSetsCount++;
      });
    });

    if (completedSetsCount === 0) {
      setActiveExercises([]);
      wasInitializedRef.current = false;
      onDiscard();
    } else {
      Alert.alert(
        'Discard Workout?',
        'Are you sure you want to discard this workout? All tracked sets will be permanently lost.',
        [
          { text: 'Keep Tracking', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setActiveExercises([]);
              wasInitializedRef.current = false;
              onDiscard();
            },
          },
        ]
      );
    }
  };

  // Exercise menu press
  const handleExerciseMenuPress = (exIdx: number) => {
    setActiveExerciseMenuIndex(exIdx);
    setIsExMenuVisible(true);
  };

  const handleRemoveExercise = () => {
    if (activeExerciseMenuIndex !== null) {
      Alert.alert(
        'Remove Exercise',
        `Are you sure you want to remove "${activeExercises[activeExerciseMenuIndex].name}" from your active session?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              const targetIdx = activeExerciseMenuIndex;
              setActiveExercises(prev => prev.filter((_, idx) => idx !== targetIdx));
              setIsExMenuVisible(false);
              // Shift or clear active input if it matches the deleted exercise
              setActiveInput(prev => {
                if (prev) {
                  if (prev.exIdx === targetIdx) {
                    return null; // Focused exercise was deleted
                  } else if (prev.exIdx > targetIdx) {
                    return { ...prev, exIdx: prev.exIdx - 1 }; // Shift index down
                  }
                }
                return prev;
              });
              setActiveExerciseMenuIndex(null);
            }
          }
        ]
      );
    }
  };

  const handleOpenReplace = () => {
    setIsReplaceMode(true);
    setLibrarySearch('');
    setIsExMenuVisible(false);
    setIsLibraryVisible(true);
  };

  const handleOpenAddExercise = () => {
    setIsReplaceMode(false);
    setLibrarySearch('');
    setIsLibraryVisible(true);
  };

  // Called by AddExerciseScreen when user confirms multi-select
  const handleConfirmExercisesFromPicker = useCallback((names: string[]) => {
    if (isReplaceMode && activeExerciseMenuIndex !== null && names.length > 0) {
      // Replace mode: replace the targeted exercise
      const exName = names[0];
      const targetEx = activeExercises[activeExerciseMenuIndex];
      const isUnilateral = targetEx?.sets[0]?.isUnilateral || false;

      const updatedSets = targetEx.sets.map((s, sIdx) => {
        let suggested: SetSuggestion = {
          weight: '60',
          reps: '10',
          leftWeight: '60',
          leftReps: '10',
          rightWeight: '60',
          rightReps: '10',
        };
        if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
          suggested = getProgressiveOverloadSuggestionForSet(exName, sIdx, sessions, { isUnilateral });
        } else {
          const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
          if (libEx) {
            suggested.weight = (libEx.bestWeight || 60).toString();
            suggested.reps = (libEx.bestReps || 10).toString();
            suggested.leftWeight = suggested.weight;
            suggested.leftReps = suggested.reps;
            suggested.rightWeight = suggested.weight;
            suggested.rightReps = suggested.reps;
          }
        }
        return {
          id: `set-${activeExerciseMenuIndex}-${sIdx}-${Date.now()}`,
          weight: '',
          reps: '',
          completed: false,
          rpe: '',
          category: (s.category || 'S') as 'W' | 'S' | 'D' | 'F',
          isUnilateral: isUnilateral,
          leftWeight: isUnilateral ? '' : undefined,
          leftReps: isUnilateral ? '' : undefined,
          rightWeight: isUnilateral ? '' : undefined,
          rightReps: isUnilateral ? '' : undefined,
          suggestedWeight: suggested.weight,
          suggestedReps: suggested.reps,
          suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
          suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
          suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
          suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
        };
      });

      setActiveExercises(prev => prev.map((ex, idx) => {
        if (idx === activeExerciseMenuIndex) {
          return {
            id: ex.id,
            name: exName,
            sets: updatedSets,
            superSetGroupId: ex.superSetGroupId,
          };
        }
        return ex;
      }));
      setActiveExerciseMenuIndex(null);
    } else {
      // Add mode: append all selected exercises
      const newOnes: ActiveExercise[] = names.map((exName, idx) => {
        const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
        const isUnilateral = libEx?.isUnilateral || false;
        
        let setsCount = 3;
        if (sessions && sessions.length > 0) {
          const previousSession = sessions.find((s: any) =>
            s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase())
          );
          const found = previousSession?.exercises.find((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase());
          if (found) {
            setsCount = typeof found.sets === 'number' ? found.sets : (found.setsDetails?.length || found.sets?.length || 3);
          }
        }

        const sets = Array.from({ length: setsCount }).map((_, sIdx) => {
          let suggested: SetSuggestion = {
            weight: '60',
            reps: '10',
            leftWeight: '60',
            leftReps: '10',
            rightWeight: '60',
            rightReps: '10',
          };
          if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
            suggested = getProgressiveOverloadSuggestionForSet(exName, sIdx, sessions, { isUnilateral });
          } else if (libEx) {
            suggested.weight = (libEx.bestWeight || 60).toString();
            suggested.reps = (libEx.bestReps || 10).toString();
            suggested.leftWeight = suggested.weight;
            suggested.leftReps = suggested.reps;
            suggested.rightWeight = suggested.weight;
            suggested.rightReps = suggested.reps;
          }
          return {
            id: `set-new-${idx}-${sIdx}-${Date.now()}`,
            weight: '',
            reps: '',
            completed: false,
            rpe: '',
            category: 'S' as const,
            isUnilateral: isUnilateral,
            leftWeight: isUnilateral ? '' : undefined,
            leftReps: isUnilateral ? '' : undefined,
            rightWeight: isUnilateral ? '' : undefined,
            rightReps: isUnilateral ? '' : undefined,
            suggestedWeight: suggested.weight,
            suggestedReps: suggested.reps,
            suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
            suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
            suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
            suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
          };
        });

        return {
          id: `ex-new-${idx}-${Date.now()}-${Math.random()}`,
          name: exName,
          sets: sets,
        };
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveExercises(prev => [...prev, ...newOnes]);
    }
    setIsLibraryVisible(false);
  }, [isReplaceMode, activeExerciseMenuIndex, isProgressiveOverloadEnabled, sessions, exerciseLibrary, activeExercises]);

  // Legacy single-select compat (used internally)
  const handleSelectLibraryExercise = (exName: string) => {
    handleConfirmExercisesFromPicker([exName]);
  };

  // ── Exercise Drag Helpers ────────────────────────────────────────────────────
  const handleExerciseDragMove = useCallback((gestureStateY: number) => {
    if (exDragIdx.current === -1 || !exActiveKey) return;
    const currentLayout = exItemLayouts.current[exActiveKey];
    if (!currentLayout) return;
    const currentCenterY = currentLayout.y + currentLayout.height / 2 + gestureStateY;
    let targetIndex = exDragIdx.current;
    setActiveExercises(current => {
      for (let i = 0; i < current.length; i++) {
        const key = current[i].id;
        const layout = exItemLayouts.current[key];
        if (layout && key !== exActiveKey) {
          if (i < exDragIdx.current && currentCenterY < layout.y + layout.height) { targetIndex = i; break; }
          if (i > exDragIdx.current && currentCenterY > layout.y) { targetIndex = i; }
        }
      }
      if (targetIndex !== exHoverIdx.current) {
        exHoverIdx.current = targetIndex;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const reordered = [...current];
        const [moved] = reordered.splice(exDragIdx.current, 1);
        reordered.splice(targetIndex, 0, moved);
        exDragIdx.current = targetIndex;
        if (Platform.OS !== 'web') Vibration.vibrate(10);
        return reordered;
      }
      return current;
    });
  }, [exActiveKey]);

  // Ref to hold the latest drag move callback to avoid stale closure in PanResponder
  const handleExerciseDragMoveRef = useRef(handleExerciseDragMove);
  useEffect(() => {
    handleExerciseDragMoveRef.current = handleExerciseDragMove;
  }, [handleExerciseDragMove]);

  // Static gesture map for reordering exercises (cached per item ID)
  const exGestureMap = useRef<{ [id: string]: any }>({});
  const getExerciseDragHandlers = useCallback((itemKey: string) => {
    if (!exGestureMap.current[itemKey]) {
      const panGesture = Gesture.Pan()
        .activateAfterLongPress(250)
        .runOnJS(true)
        .onStart(() => {
          const currentIndex = exIndicesRef.current[itemKey];
          if (currentIndex !== undefined && currentIndex !== -1) {
            const initialSlots: number[] = [];
            activeExercisesRef.current.forEach((ex) => {
              const layout = exItemLayouts.current[ex.id];
              initialSlots.push(layout ? layout.y : 0);
            });
            exSlotYRef.current = initialSlots;
            exInitialYRef.current = exItemLayouts.current[itemKey]?.y || 0;

            setExActiveKey(itemKey);
            exDragIdx.current  = currentIndex;
            exHoverIdx.current = currentIndex;
            exDragY.value = 0;
            if (Platform.OS !== 'web') Vibration.vibrate(20);
          }
        })
        .onUpdate((e) => {
          const yInitial = exInitialYRef.current;
          const currentIdx = exDragIdx.current;
          const yCurrent = exSlotYRef.current[currentIdx] !== undefined ? exSlotYRef.current[currentIdx] : yInitial;
          const translation = e.translationY + (yInitial - yCurrent);
          exDragY.value = translation;
          handleExerciseDragMoveRef.current(e.translationY);
        })
        .onEnd(() => {
          setExActiveKey(null);
          exDragIdx.current  = -1;
          exHoverIdx.current = -1;
          exDragY.value = 0;
          setActiveExercises(prev => sanitizeSuperSets(prev));
        })
        .onFinalize(() => {
          setExActiveKey(null);
          exDragIdx.current  = -1;
          exHoverIdx.current = -1;
          exDragY.value = 0;
          setActiveExercises(prev => sanitizeSuperSets(prev));
        });
      exGestureMap.current[itemKey] = panGesture;
    }
    return exGestureMap.current[itemKey];
  }, []);

  const handleSaveCustomExercise = () => {
    if (!customExerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name.');
      return;
    }
    if (onAddCustomExercise) {
      const newEx = onAddCustomExercise(
        customExerciseName.trim(),
        customMuscleGroup,
        customEquipment
      );
      if (newEx) {
        const newActive = {
          id: `ex-custom-${Date.now()}-${Math.random()}`,
          name: newEx.name,
          sets: [
            { id: `set-${Date.now()}-0`, weight: '60', reps: '10', completed: false },
            { id: `set-${Date.now()}-1`, weight: '60', reps: '10', completed: false },
            { id: `set-${Date.now()}-2`, weight: '60', reps: '10', completed: false },
          ]
        };
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveExercises(prev => [...prev, newActive]);
        setIsLibraryVisible(false);
        setIsCreatingCustom(false);
      }
    } else {
      Alert.alert('Info', 'Database integration is missing in this view.');
    }
  };

  // Search filtered library exercises
  const filteredLibrary = useMemo(() => {
    if (!librarySearch.trim()) return exerciseLibrary;
    return exerciseLibrary.filter(ex => ex.name.toLowerCase().includes(librarySearch.toLowerCase().trim()));
  }, [exerciseLibrary, librarySearch]);

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.modalContainer}>
            {/* ── Header ────────────────────────────────────────── */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.minimizeBtn,
                    pressed && { transform: [{ scale: 0.96 }] }
                  ]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  android_ripple={rippleTokens.borderless}
                  accessibilityLabel="Minimize workout screen"
                >
                  <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
                </Pressable>
                
                <Pressable
                  onPress={() => {
                    if (isTimerActive) {
                      setIsTimerSubMenuVisible(!isTimerSubMenuVisible);
                    } else {
                      restTimerEndTarget.current = Date.now() + defaultRestDuration * 1000;
                      setRestTimeRemaining(defaultRestDuration);
                      setIsTimerActive(true);
                      cancelAndScheduleRestNotification(defaultRestDuration);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.headerStopwatchBtn,
                    isTimerActive && styles.headerTimerBtnActive,
                    pressed && { transform: [{ scale: 0.96 }] }
                  ]}
                  android_ripple={rippleTokens.surface}
                  accessibilityLabel="Toggle rest timer"
                >
                  <Ionicons 
                    name={isTimerActive ? "stopwatch" : "stopwatch-outline"} 
                    size={18} 
                    color={isTimerActive ? colors.accent : colors.textPrimary} 
                  />
                  {isTimerActive && (
                    <Text style={styles.headerRestTimerText}>{restTimeRemaining}s</Text>
                  )}
                </Pressable>
 
                {isPlateCalculatorEnabled && (
                  <Pressable
                    onPress={() => setIsPlateCalcVisible(true)}
                    style={({ pressed }) => [
                      styles.headerStopwatchBtn,
                      pressed && { transform: [{ scale: 0.96 }] }
                    ]}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Open plate calculator"
                  >
                    <Ionicons name="disc-outline" size={18} color={colors.textPrimary} />
                  </Pressable>
                )}
              </View>
 
              {(() => {
                const sessionSec = Math.max(0, Math.floor((Date.now() - resumeStartTime.current.getTime()) / 1000));
                const totalSeconds = sessionSec + accumulatedOffsetSeconds.current;
                return (
                  <View style={[styles.headerCenter, { pointerEvents: 'box-none' }]}>
                    <Pressable
                      onPress={toggleTimerFormat}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                          opacity: pressed ? 0.75 : 1.0,
                        },
                        pressed && { transform: [{ scale: 0.96 }] }
                      ]}
                      hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                      accessibilityLabel="Toggle elapsed timer format"
                    >
                      <Animated.View
                        style={[
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          },
                          animatedTimerStyle,
                        ]}
                      >
                        {showSecondsOnly ? (
                          <Text style={styles.headerTimerText}>{totalSeconds}s</Text>
                        ) : (
                          <Text style={styles.headerTimerText}>{elapsed}</Text>
                        )}
                        {isLiveHeartRateEnabled && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 }}>
                            <Ionicons name="heart" size={14} color={colors.error} />
                            <Text style={{ color: colors.error, fontSize: 13, fontFamily: font.bold }}>{heartRate}</Text>
                          </View>
                        )}
                      </Animated.View>
                    </Pressable>
                  </View>
                );
              })()}
 
              <View style={styles.headerRight}>
                <Pressable
                  onPress={handleOpenAddExercise}
                  style={({ pressed }) => [
                    styles.headerStopwatchBtn,
                    { marginRight: spacing.sm },
                    pressed && { transform: [{ scale: 0.96 }] }
                  ]}
                  android_ripple={rippleTokens.surface}
                  accessibilityLabel="Add Exercise"
                >
                  <Ionicons name="add" size={20} color={colors.accent} />
                </Pressable>
                <Pressable
                  onPress={handleFinishPress}
                  style={({ pressed }) => [
                    styles.headerFinishBtn,
                    pressed && { transform: [{ scale: 0.96 }] }
                  ]}
                  android_ripple={rippleTokens.accent}
                  accessibilityLabel="Finish workout"
                >
                  <Ionicons name="checkmark" size={20} color="#0D0F14" />
                </Pressable>
              </View>
            </View>




            {/* ── Scrollable Exercises List ────────────────────────── */}
            <ScrollView
              scrollEnabled={exActiveKey === null}
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                isTimerActive ? { paddingBottom: spacing.xxxl * 3 } : { paddingBottom: spacing.xxl },
                activeInput !== null && { paddingBottom: 280 }
              ]}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
            >
              {/* Workout Title Section */}
              <View style={styles.workoutTitleSection}>
                <TextInput
                  style={styles.workoutTitleInput}
                  value={localWorkoutName}
                  onChangeText={(val) => {
                    setLocalWorkoutName(val);
                    if (onRenameWorkout) {
                      onRenameWorkout(val);
                    }
                  }}
                  placeholder="Workout Name..."
                  placeholderTextColor={colors.textMuted}
                  keyboardAppearance="dark"
                  maxLength={40}
                />
                <Pressable
                  onPress={() => setIsWorkoutMenuVisible(true)}
                  style={({ pressed }) => [
                    styles.workoutTitleOptionsBtn,
                    pressed && { transform: [{ scale: 0.96 }] }
                  ]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  android_ripple={rippleTokens.borderless}
                  accessibilityLabel="Workout options"
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.accent} />
                </Pressable>
              </View>

              {/* Workout Note Display */}
              {workoutNote ? (
                <Pressable
                  onPress={() => setIsWorkoutNoteModalVisible(true)}
                  style={[
                    styles.notesContainer,
                    {
                      marginTop: 0,
                      marginBottom: spacing.lg,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      backgroundColor: colors.surface2,
                    }
                  ]}
                  android_ripple={rippleTokens.surface}
                  accessibilityLabel="Edit workout note"
                >
                  <Ionicons name="document-text-outline" size={16} color={colors.accent} />
                  <Text style={[styles.notesText, { color: colors.textPrimary, fontSize: font.sizes.sm }]} numberOfLines={3}>
                    {workoutNote}
                  </Text>
                </Pressable>
              ) : null}

              {activeExercises.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No exercises added yet.</Text>
                </View>
              ) : (
                activeExercises.map((exercise, exIdx) => {
                  exIndicesRef.current[exercise.id] = exIdx;
                  const isSuperSet = !!exercise.superSetGroupId;
                  const nextIsSameSuperSet = isSuperSet && exIdx < activeExercises.length - 1 && activeExercises[exIdx + 1].superSetGroupId === exercise.superSetGroupId;
                  const prevIsSameSuperSet = isSuperSet && exIdx > 0 && activeExercises[exIdx - 1].superSetGroupId === exercise.superSetGroupId;
                  const superSetColor = exercise.superSetGroupId ? (superSetColors[exercise.superSetGroupId] || colors.accent) : undefined;
                  const exItemKey = exercise.id;
                  const isExActive = exActiveKey === exItemKey;

                  return (
                    <ActiveExerciseRow
                      key={exItemKey}
                      exercise={exercise}
                      exIdx={exIdx}
                      exItemKey={exItemKey}
                      isExActive={isExActive}
                      exDragY={exDragY}
                      exItemLayouts={exItemLayouts}
                      isSuperSet={isSuperSet}
                      nextIsSameSuperSet={nextIsSameSuperSet}
                      prevIsSameSuperSet={prevIsSameSuperSet}
                      superSetColor={superSetColor}
                      handleExerciseMenuPress={handleExerciseMenuPress}
                      getExerciseDragHandlers={getExerciseDragHandlers}
                      exerciseLibrary={exerciseLibrary}
                      activeInput={activeInput}
                      handleSetFocus={handleSetFocus}
                      updateSetField={updateSetField}
                      deleteSet={deleteSet}
                      toggleSetComplete={toggleSetComplete}
                      inputRefs={inputRefs}
                      isRpeMode={isRpeMode}
                      addSet={addSet}
                      tempInputValue={activeInput?.exIdx === exIdx ? tempInputValue : undefined}
                    />
                  );
                })
              )}

              {/* Discard Workout button */}
              <Pressable
                style={({ pressed }) => [
                  styles.scrollDiscardBtn,
                  pressed && { transform: [{ scale: 0.96 }] }
                ]}
                onPress={handleDiscardPress}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} style={{ marginRight: spacing.xs }} />
                <Text style={styles.scrollDiscardText}>DISCARD WORKOUT</Text>
              </Pressable>
            </ScrollView>

            {/* Timer Ruler Sub-menu */}
            {isTimerSubMenuVisible && (
              <View style={styles.timerSubMenu}>
                <RestTimerRuler
                  currentSecs={restTimeRemaining}
                  defaultSecs={defaultRestDuration}
                  isRunning={isTimerActive}
                  onSecsChange={(secs) => {
                    if (!restTimerEndTarget.current) return;
                    const newTarget = Date.now() + secs * 1000;
                    restTimerEndTarget.current = newTarget;
                    setRestTimeRemaining(secs);
                  }}
                  onSecsChangeComplete={(secs) => {
                    cancelAndScheduleRestNotification(secs);
                  }}
                  onDragStart={() => {
                    isRulerDragging.current = true;
                  }}
                  onDragEnd={() => {
                    isRulerDragging.current = false;
                  }}
                  onStopStart={() => {
                    setIsTimerActive(false);
                    restTimerEndTarget.current = null;
                    Notifications.cancelAllScheduledNotificationsAsync();
                    playSatisfyingClickStopTimer();
                  }}
                  onStopComplete={() => {
                    setIsTimerSubMenuVisible(false);
                  }}
                  onStart={() => {
                    restTimerEndTarget.current = Date.now() + defaultRestDuration * 1000;
                    setRestTimeRemaining(defaultRestDuration);
                    setIsTimerActive(true);
                    cancelAndScheduleRestNotification(defaultRestDuration);
                  }}
                />
              </View>
            )}



            {/* ── Global Exercise Picker (replaces old transparent Modal A) ── */}

            {/* Modal B: Ellipsis Actions Context Sheet for Active Exercise */}
            {isExMenuVisible && activeExerciseMenuIndex !== null && (
              <Modal
                visible={isExMenuVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsExMenuVisible(false)}
              >
                <Pressable
                  style={styles.sheetBackdrop}
                  onPress={() => setIsExMenuVisible(false)}
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...exMenuPanResponder.panHandlers}
                  >
                    <View style={styles.dragHandleContainer}>
                      <View style={styles.sheetDragHandle} />
                    </View>

                    <Text style={styles.sheetTitle}>
                      {activeExercises[activeExerciseMenuIndex].name.toUpperCase()}
                    </Text>

                    <Pressable
                      style={styles.sheetItem}
                      onPress={() => {
                        const currentTimer = activeExercises[activeExerciseMenuIndex].autoTimer;
                        setCustomTimerValue(currentTimer ? currentTimer.toString() : '');
                        setIsExMenuVisible(false);
                        setIsTimerPickerVisible(true);
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="time-outline" size={20} color={colors.accent} />
                      <Text style={styles.sheetItemText}>Set Auto-Timer</Text>
                    </Pressable>
                    
                    {activeExercises[activeExerciseMenuIndex].superSetGroupId ? (
                      <Pressable
                        style={styles.sheetItem}
                        onPress={() => {
                          const targetGroupId = activeExercises[activeExerciseMenuIndex].superSetGroupId;
                          setActiveExercises(prev => prev.map(ex => 
                            ex.superSetGroupId === targetGroupId ? { ...ex, superSetGroupId: undefined } : ex
                          ));
                          setIsExMenuVisible(false);
                        }}
                        android_ripple={rippleTokens.surface}
                      >
                        <Ionicons name="link-outline" size={20} color={colors.accent} />
                        <Text style={styles.sheetItemText}>Unlink Super Set</Text>
                      </Pressable>
                    ) : (
                      <>
                        {activeExerciseMenuIndex < activeExercises.length - 1 && (
                          <Pressable
                            style={styles.sheetItem}
                            onPress={() => {
                              const newGroupId = `ss-${Date.now()}`;
                              setActiveExercises(prev => prev.map((ex, idx) => {
                                if (idx === activeExerciseMenuIndex || idx === activeExerciseMenuIndex + 1) {
                                  return { ...ex, superSetGroupId: newGroupId };
                                }
                                return ex;
                              }));
                              setIsExMenuVisible(false);
                            }}
                            android_ripple={rippleTokens.surface}
                          >
                            <Ionicons name="link-outline" size={20} color={colors.accent} />
                            <Text style={styles.sheetItemText}>Link with Next (Super Set)</Text>
                          </Pressable>
                        )}
                        {activeExerciseMenuIndex > 0 && (
                          <Pressable
                            style={styles.sheetItem}
                            onPress={() => {
                              const newGroupId = `ss-${Date.now()}`;
                              setActiveExercises(prev => prev.map((ex, idx) => {
                                if (idx === activeExerciseMenuIndex || idx === activeExerciseMenuIndex - 1) {
                                  return { ...ex, superSetGroupId: newGroupId };
                                }
                                return ex;
                              }));
                              setIsExMenuVisible(false);
                            }}
                            android_ripple={rippleTokens.surface}
                          >
                            <Ionicons name="link-outline" size={20} color={colors.accent} />
                            <Text style={styles.sheetItemText}>Link with Previous (Super Set)</Text>
                          </Pressable>
                        )}
                      </>
                    )}

                    <Pressable
                      style={styles.sheetItem}
                      onPress={() => {
                        if (activeExerciseMenuIndex !== null) {
                          const exName = activeExercises[activeExerciseMenuIndex].name;
                          const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
                          setNoteText(libEx?.notes || '');
                          setIsExMenuVisible(false);
                          setIsNotesModalVisible(true);
                        }
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                      <Text style={styles.sheetItemText}>View/Edit Notes</Text>
                    </Pressable>

                    <Pressable
                      style={styles.sheetItem}
                      onPress={handleOpenReplace}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="swap-horizontal-outline" size={20} color={colors.accent} />
                      <Text style={styles.sheetItemText}>Replace Exercise</Text>
                    </Pressable>

                    <Pressable
                      style={styles.sheetItem}
                      onPress={handleRemoveExercise}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                      <Text style={[styles.sheetItemText, { color: colors.error }]}>Remove Exercise</Text>
                    </Pressable>
                  </RN.Animated.View>
                </Pressable>
              </Modal>
            )}

            {/* Modal E: Set Auto-Timer for Active Exercise */}
            {isTimerPickerVisible && activeExerciseMenuIndex !== null && (
              <Modal
                visible={isTimerPickerVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setIsTimerPickerVisible(false)}
              >
                <Pressable
                  style={styles.sheetBackdrop}
                  onPress={() => setIsTimerPickerVisible(false)}
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...timerPickerPanResponder.panHandlers}
                  >
                    <View style={styles.dragHandleContainer}>
                      <View style={styles.sheetDragHandle} />
                    </View>

                    <Text style={styles.sheetTitle}>
                      {activeExercises[activeExerciseMenuIndex].name.toUpperCase()}
                    </Text>
                    
                    <Text style={{
                      color: colors.textSecondary,
                      fontSize: font.sizes.xs,
                      fontFamily: font.medium,
                      marginBottom: spacing.xs,
                    }}>
                      Configure custom rest duration (seconds)
                    </Text>

                    <View style={styles.bottomSheetOptions}>
                      {/* Option to clear custom rest duration */}
                      <Pressable
                        style={[
                          styles.soundOptionRow,
                          activeExercises[activeExerciseMenuIndex].autoTimer === undefined && styles.soundOptionRowActive
                        ]}
                        onPress={() => {
                          setActiveExercises(prev => {
                            const updated = [...prev];
                            updated[activeExerciseMenuIndex] = {
                              ...updated[activeExerciseMenuIndex],
                              autoTimer: undefined,
                            };
                            return updated;
                          });
                          setIsTimerPickerVisible(false);
                        }}
                        android_ripple={rippleTokens.surface}
                      >
                        <View style={styles.soundOptionLeft}>
                          <Ionicons 
                            name="globe-outline" 
                            size={18} 
                            color={activeExercises[activeExerciseMenuIndex].autoTimer === undefined ? colors.accent : colors.textSecondary} 
                          />
                          <Text style={[
                            styles.soundOptionText,
                            activeExercises[activeExerciseMenuIndex].autoTimer === undefined && styles.soundOptionTextActive
                          ]}>
                            Use Global Default ({defaultRestDuration}s)
                          </Text>
                        </View>
                        {activeExercises[activeExerciseMenuIndex].autoTimer === undefined && (
                          <Ionicons name="checkmark" size={20} color={colors.accent} />
                        )}
                      </Pressable>

                      {([30, 60, 90, 120, 180] as const).map((durationVal) => {
                        const isSelected = activeExercises[activeExerciseMenuIndex].autoTimer === durationVal;
                        return (
                          <Pressable
                            key={durationVal}
                            style={[
                              styles.soundOptionRow,
                              isSelected && styles.soundOptionRowActive
                            ]}
                            onPress={() => {
                              setActiveExercises(prev => {
                                const updated = [...prev];
                                updated[activeExerciseMenuIndex] = {
                                  ...updated[activeExerciseMenuIndex],
                                  autoTimer: durationVal,
                                };
                                return updated;
                              });
                              setIsTimerPickerVisible(false);
                            }}
                            android_ripple={rippleTokens.surface}
                          >
                            <View style={styles.soundOptionLeft}>
                              <Ionicons 
                                name="time-outline" 
                                size={18} 
                                color={isSelected ? colors.accent : colors.textSecondary} 
                              />
                              <Text style={[
                                styles.soundOptionText,
                                isSelected && styles.soundOptionTextActive
                              ]}>
                                {durationVal < 60 ? `${durationVal}s` : `${durationVal / 60}m (${durationVal}s)`}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark" size={20} color={colors.accent} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Custom input card */}
                    <Card padding={spacing.md} style={styles.customTimerContainer}>
                      <Text style={styles.customTimerTitle}>Custom Rest Duration (Seconds)</Text>
                      <View style={styles.customTimerRow}>
                        <TextInput
                          style={styles.customTimerInput}
                          keyboardType="number-pad"
                          value={customTimerValue}
                          onChangeText={(val) => setCustomTimerValue(val.replace(/[^0-9]/g, ''))}
                          placeholder="E.g. 45"
                          placeholderTextColor={colors.textMuted}
                          maxLength={4}
                        />
                        <Pressable
                          style={styles.customTimerBtn}
                          onPress={() => {
                            const parsed = parseInt(customTimerValue, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              setActiveExercises(prev => {
                                const updated = [...prev];
                                updated[activeExerciseMenuIndex] = {
                                  ...updated[activeExerciseMenuIndex],
                                  autoTimer: parsed,
                                };
                                return updated;
                              });
                              setIsTimerPickerVisible(false);
                            } else {
                              Alert.alert('Invalid Input', 'Please enter a valid number of seconds.');
                            }
                          }}
                          android_ripple={rippleTokens.surface}
                        >
                          <Text style={styles.customTimerBtnText}>Save</Text>
                        </Pressable>
                      </View>
                    </Card>
                  </RN.Animated.View>
                </Pressable>
              </Modal>
            )}

            {/* Modal D: View / Edit Exercise Notes */}
            {isNotesModalVisible && activeExerciseMenuIndex !== null && (
              <Modal
                visible={isNotesModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setIsNotesModalVisible(false)}
              >
                <Pressable
                  style={styles.backdrop}
                  onPress={() => setIsNotesModalVisible(false)}
                >
                  <Pressable
                    style={styles.card}
                    onPress={e => e.stopPropagation()}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>EXERCISE NOTES</Text>
                      <IconButton
                        name="close"
                        size={22}
                        color={colors.textSecondary}
                        onPress={() => setIsNotesModalVisible(false)}
                      />
                    </View>

                    <View style={styles.plateCalcBody}>
                      <Text style={styles.noteModalHeader}>
                        {activeExercises[activeExerciseMenuIndex].name}
                      </Text>
                      <TextInput
                        style={[styles.plateCalcInput, { minHeight: 100, textAlignVertical: 'top' }]}
                        placeholder="Enter workout cue, seat height, or custom setting notes..."
                        placeholderTextColor={colors.textMuted}
                        value={noteText}
                        onChangeText={setNoteText}
                        multiline
                        keyboardAppearance="dark"
                        maxLength={150}
                        autoFocus
                      />

                      <View style={{ flexDirection: 'row', columnGap: spacing.md, marginTop: spacing.md, width: '100%' }}>
                        <Pressable
                          style={[styles.modalBtnCancel, { flex: 1 }]}
                          onPress={() => setIsNotesModalVisible(false)}
                        >
                          <Text style={styles.modalBtnCancelText}>CANCEL</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modalBtnSave, { flex: 1 }]}
                          onPress={() => {
                            const exName = activeExercises[activeExerciseMenuIndex].name;
                            const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
                            if (libEx && onUpdateExerciseNotes) {
                              onUpdateExerciseNotes(libEx.id, noteText.trim() || undefined);
                              Alert.alert('Success', 'Note saved successfully!');
                            } else {
                              Alert.alert('Info', 'Note updated locally');
                            }
                            setIsNotesModalVisible(false);
                          }}
                        >
                          <Text style={styles.modalBtnSaveText}>SAVE</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Modal C: Barbell Plate Calculator */}
            {isPlateCalcVisible && (
              <Modal
                visible={isPlateCalcVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsPlateCalcVisible(false)}
              >
                <Pressable
                  style={styles.backdrop}
                  onPress={() => setIsPlateCalcVisible(false)}
                >
                  <Pressable
                    style={styles.card}
                    onPress={e => e.stopPropagation()}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>PLATE CALCULATOR</Text>
                      <IconButton
                        name="close"
                        size={22}
                        color={colors.textSecondary}
                        onPress={() => setIsPlateCalcVisible(false)}
                      />
                    </View>

                    <View style={styles.plateCalcBody}>
                      {/* Bar weight toggle */}
                      <View style={styles.barWeightToggleRow}>
                        <Text style={styles.plateCalcLabel}>BARBELL WEIGHT</Text>
                        <View style={styles.barWeightToggleGroup}>
                          <Pressable
                            style={[styles.barToggleBtn, barWeight === 20 && styles.barToggleBtnActive]}
                            onPress={() => setBarWeight(20)}
                          >
                            <Text style={[styles.barToggleText, barWeight === 20 && styles.barToggleTextActive]}>20 kg</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.barToggleBtn, barWeight === 15 && styles.barToggleBtnActive]}
                            onPress={() => setBarWeight(15)}
                          >
                            <Text style={[styles.barToggleText, barWeight === 15 && styles.barToggleTextActive]}>15 kg</Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* Weight input */}
                      <View style={{ rowGap: spacing.xs, marginVertical: spacing.sm }}>
                        <Text style={styles.plateCalcLabel}>TARGET TOTAL WEIGHT (KG)</Text>
                        <TextInput
                          style={styles.plateCalcInput}
                          keyboardType="numeric"
                          value={plateCalcTargetWeight}
                          onChangeText={setPlateCalcTargetWeight}
                          keyboardAppearance="dark"
                          selectTextOnFocus
                          placeholder="e.g. 100"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>

                      {/* Plate breakdown */}
                      <View style={styles.visualBarbellContainer}>
                        <Text style={styles.plateCalcSectionTitle}>PLATES PER SIDE (ONE SLEEVE)</Text>
                        {calculatedPlates.length === 0 ? (
                          <View style={styles.emptyPlatesBox}>
                            <Text style={styles.emptyPlatesText}>
                              {parseFloat(plateCalcTargetWeight) <= barWeight
                                ? "Weight must exceed barbell weight."
                                : "Add weight to calculate plates."}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.platesDisplay}>
                            {/* Visual representation of barbell sleeve */}
                            <View style={styles.barbellSleeveVisual}>
                              {/* Sleeve bar */}
                              <View style={styles.sleeveBarLine} />
                              {/* Sleeve stop */}
                              <View style={styles.sleeveStop} />
                              
                              {/* Plates array stacked on sleeve */}
                              <View style={styles.stackedPlatesContainer}>
                                {calculatedPlates.map((plate) => {
                                  const scaleFactor = plate.size >= 25 ? 1.0 : plate.size >= 20 ? 0.93 : plate.size >= 15 ? 0.86 : plate.size >= 10 ? 0.79 : plate.size >= 5 ? 0.72 : 0.65;
                                  const heightVal = 86 * scaleFactor;
                                  const widthVal = 13 * scaleFactor;
                                  
                                  return (
                                    <View
                                      key={`${plate.size}-${plate.color}`}
                                      style={[
                                        styles.visualPlate,
                                        {
                                          backgroundColor: plate.color,
                                          height: heightVal,
                                          width: widthVal,
                                          borderRadius: 3,
                                          marginRight: 2,
                                        }
                                      ]}
                                    >
                                      <Text style={[styles.visualPlateText, { color: plate.textColor, fontSize: 8 * scaleFactor }]}>
                                        {plate.size}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>

                            {/* Plate list legend text */}
                            <View style={styles.platesTextLegend}>
                              {(() => {
                                const counts: Record<number, number> = {};
                                calculatedPlates.forEach(p => {
                                  counts[p.size] = (counts[p.size] || 0) + 1;
                                });
                                return Object.keys(counts).sort((a, b) => parseFloat(b) - parseFloat(a)).map(sizeStr => {
                                  const size = parseFloat(sizeStr);
                                  const count = counts[size];
                                  return (
                                    <Text key={sizeStr} style={styles.legendTextLine}>
                                      • <Text style={{ color: colors.textPrimary, fontFamily: font.bold }}>{count}x</Text> {size} kg plate{count > 1 ? 's' : ''}
                                    </Text>
                                  );
                                });
                              })()}
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Workout Options Bottom Sheet Menu */}
            {isWorkoutMenuVisible && (
              <Modal
                visible={isWorkoutMenuVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsWorkoutMenuVisible(false)}
              >
                <Pressable
                  style={styles.sheetBackdrop}
                  onPress={() => setIsWorkoutMenuVisible(false)}
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...workoutMenuPanResponder.panHandlers}
                  >
                    <View style={styles.dragHandleContainer}>
                      <View style={styles.sheetDragHandle} />
                    </View>

                    <Text style={styles.sheetTitle}>
                      WORKOUT OPTIONS
                    </Text>

                    <View style={{ rowGap: spacing.sm }}>
                      {/* Note option */}
                      <Pressable
                        style={styles.sheetItem}
                        onPress={() => {
                          setIsWorkoutMenuVisible(false);
                          setIsWorkoutNoteModalVisible(true);
                        }}
                        android_ripple={rippleTokens.surface}
                      >
                        <Ionicons name="document-text-outline" size={20} color={colors.textPrimary} />
                        <Text style={styles.sheetItemText}>Add Workout Note</Text>
                      </Pressable>

                      {/* Change Start Time option */}
                      <Pressable
                        style={styles.sheetItem}
                        onPress={() => {
                          setIsWorkoutMenuVisible(false);
                          setEditedStartTimeText(startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
                          setIsStartTimePickerVisible(true);
                        }}
                        android_ripple={rippleTokens.surface}
                      >
                        <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
                        <Text style={styles.sheetItemText}>Change Start Time</Text>
                      </Pressable>

                      {/* Change Default Timer option */}
                      <Pressable
                        style={styles.sheetItem}
                        onPress={() => {
                          setIsWorkoutMenuVisible(false);
                          setIsDefaultTimerPickerVisible(true);
                        }}
                        android_ripple={rippleTokens.surface}
                      >
                        <Ionicons name="alarm-outline" size={20} color={colors.textPrimary} />
                        <Text style={styles.sheetItemText}>Change Default Rest Timer</Text>
                      </Pressable>

                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

                      {/* Discard Workout */}
                      <Pressable
                        style={styles.sheetItem}
                        onPress={() => {
                          setIsWorkoutMenuVisible(false);
                          handleDiscardPress();
                        }}
                        android_ripple={rippleTokens.surface}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                        <Text style={[styles.sheetItemText, { color: colors.error }]}>Discard Workout</Text>
                      </Pressable>
                    </View>
                  </RN.Animated.View>
                </Pressable>
              </Modal>
            )}

            {/* Workout Note Modal */}
            {isWorkoutNoteModalVisible && (
              <Modal
                visible={isWorkoutNoteModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setIsWorkoutNoteModalVisible(false)}
              >
                <Pressable
                  style={styles.backdrop}
                  onPress={() => setIsWorkoutNoteModalVisible(false)}
                >
                  <Pressable
                    style={styles.card}
                    onPress={e => e.stopPropagation()}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>WORKOUT NOTE</Text>
                      <IconButton
                        name="close"
                        size={22}
                        color={colors.textSecondary}
                        onPress={() => setIsWorkoutNoteModalVisible(false)}
                      />
                    </View>

                    <View style={styles.plateCalcBody}>
                      <Text style={styles.noteModalHeader}>
                        {localWorkoutName}
                      </Text>
                      <TextInput
                        style={[styles.plateCalcInput, { minHeight: 100, textAlignVertical: 'top' }]}
                        placeholder="Add a comment or note about this workout session..."
                        placeholderTextColor={colors.textMuted}
                        value={workoutNote}
                        onChangeText={setWorkoutNote}
                        multiline
                        keyboardAppearance="dark"
                        maxLength={150}
                        autoFocus
                      />

                      <View style={{ flexDirection: 'row', columnGap: spacing.md, marginTop: spacing.md, width: '100%' }}>
                        <Pressable
                          style={[styles.modalBtnCancel, { flex: 1 }]}
                          onPress={() => setIsWorkoutNoteModalVisible(false)}
                        >
                          <Text style={styles.modalBtnCancelText}>CANCEL</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modalBtnSave, { flex: 1 }]}
                          onPress={() => {
                            if (onUpdateComment) {
                              onUpdateComment(workoutNote.trim());
                            }
                            setIsWorkoutNoteModalVisible(false);
                          }}
                        >
                          <Text style={styles.modalBtnSaveText}>SAVE</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Change Start Time Modal */}
            {isStartTimePickerVisible && (
              <Modal
                visible={isStartTimePickerVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setIsStartTimePickerVisible(false)}
              >
                <Pressable
                  style={styles.backdrop}
                  onPress={() => setIsStartTimePickerVisible(false)}
                >
                  <Pressable
                    style={styles.card}
                    onPress={e => e.stopPropagation()}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>CHANGE START TIME</Text>
                      <IconButton
                        name="close"
                        size={22}
                        color={colors.textSecondary}
                        onPress={() => setIsStartTimePickerVisible(false)}
                      />
                    </View>

                    <View style={styles.plateCalcBody}>
                      <Text style={styles.noteModalHeader}>
                        Enter time in 24-hour format (HH:MM)
                      </Text>
                      <TextInput
                        style={styles.plateCalcInput}
                        placeholder="e.g. 14:30"
                        placeholderTextColor={colors.textMuted}
                        value={editedStartTimeText}
                        onChangeText={setEditedStartTimeText}
                        keyboardType="default"
                        keyboardAppearance="dark"
                        maxLength={5}
                        autoFocus
                      />

                      <View style={{ flexDirection: 'row', columnGap: spacing.md, marginTop: spacing.md, width: '100%' }}>
                        <Pressable
                          style={[styles.modalBtnCancel, { flex: 1 }]}
                          onPress={() => setIsStartTimePickerVisible(false)}
                        >
                          <Text style={styles.modalBtnCancelText}>CANCEL</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modalBtnSave, { flex: 1 }]}
                          onPress={() => {
                            const match = editedStartTimeText.trim().match(/^([0-2]?[0-9]):([0-5][0-9])$/);
                            if (match) {
                              const hr = parseInt(match[1]);
                              const min = parseInt(match[2]);
                              if (hr >= 0 && hr < 24) {
                                const newStart = new Date(startTime);
                                newStart.setHours(hr);
                                newStart.setMinutes(min);
                                newStart.setSeconds(0);
                                if (onUpdateStartTime) {
                                  onUpdateStartTime(newStart);
                                }
                                if (!isEditing) {
                                  resumeStartTime.current = newStart;
                                }
                                setIsStartTimePickerVisible(false);
                              } else {
                                Alert.alert('Error', 'Invalid hours (must be 00-23)');
                              }
                            } else {
                              Alert.alert('Error', 'Invalid format. Use HH:MM');
                            }
                          }}
                        >
                          <Text style={styles.modalBtnSaveText}>SAVE</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Change Default Timer Modal */}
            {isDefaultTimerPickerVisible && (
              <Modal
                visible={isDefaultTimerPickerVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setIsDefaultTimerPickerVisible(false)}
              >
                <Pressable
                  style={styles.sheetBackdrop}
                  onPress={() => setIsDefaultTimerPickerVisible(false)}
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...workoutMenuPanResponder.panHandlers}
                  >
                    <View style={styles.dragHandleContainer}>
                      <View style={styles.sheetDragHandle} />
                    </View>

                    <Text style={styles.sheetTitle}>
                      DEFAULT REST TIMER
                    </Text>
                    
                    <Text style={{
                      color: colors.textSecondary,
                      fontSize: font.sizes.xs,
                      fontFamily: font.medium,
                      marginBottom: spacing.xs,
                    }}>
                      Configure global default rest duration (seconds)
                    </Text>

                    <View style={styles.bottomSheetOptions}>
                      {([30, 60, 90, 120, 180] as const).map((durationVal) => {
                        const isSelected = localDefaultRest === durationVal;
                        return (
                          <Pressable
                            key={durationVal}
                            style={[
                              styles.soundOptionRow,
                              isSelected && styles.soundOptionRowActive
                            ]}
                            onPress={() => {
                              setLocalDefaultRest(durationVal);
                              if (onUpdateDefaultRestDuration) {
                                onUpdateDefaultRestDuration(durationVal);
                              }
                              setIsDefaultTimerPickerVisible(false);
                            }}
                            android_ripple={rippleTokens.surface}
                          >
                            <View style={styles.soundOptionLeft}>
                              <Ionicons 
                                name="time-outline" 
                                size={18} 
                                color={isSelected ? colors.accent : colors.textSecondary} 
                              />
                              <Text style={[
                                styles.soundOptionText,
                                isSelected && styles.soundOptionTextActive
                              ]}>
                                {durationVal < 60 ? `${durationVal}s` : `${durationVal / 60}m (${durationVal}s)`}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark" size={20} color={colors.accent} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Custom input card */}
                    <Card padding={spacing.md} style={styles.customTimerContainer}>
                      <Text style={styles.customTimerTitle}>Custom Default Rest (Seconds)</Text>
                      <View style={styles.customTimerRow}>
                        <TextInput
                          style={styles.customTimerInput}
                          keyboardType="number-pad"
                          value={customDefaultTimerValue}
                          onChangeText={(val) => setCustomDefaultTimerValue(val.replace(/[^0-9]/g, ''))}
                          placeholder="E.g. 45"
                          placeholderTextColor={colors.textMuted}
                          maxLength={4}
                        />
                        <Pressable
                          style={styles.customTimerBtn}
                          onPress={() => {
                            const parsed = parseInt(customDefaultTimerValue, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              setLocalDefaultRest(parsed);
                              if (onUpdateDefaultRestDuration) {
                                onUpdateDefaultRestDuration(parsed);
                              }
                              setIsDefaultTimerPickerVisible(false);
                            }
                          }}
                        >
                          <Text style={styles.customTimerBtnText}>Save</Text>
                        </Pressable>
                      </View>
                    </Card>
                  </RN.Animated.View>
                </Pressable>
              </Modal>
            )}

            <CustomWorkoutKeyboard
              visible={activeInput !== null}
              inputKey={activeInput ? `${activeInput.exIdx}-${activeInput.setIdx}-${activeInput.fieldName}-${activeInput.focusTime || 0}` : ''}
              value={tempInputValue}
              onChange={(newValue) => {
                setTempInputValue(newValue);
                tempInputValueRef.current = newValue;
              }}
              rpeValue={
                activeInput
                  ? activeExercises[activeInput.exIdx]?.sets[activeInput.setIdx]?.rpe || ''
                  : ''
              }
              onChangeRpe={(newRpe) => {
                if (activeInput) {
                  updateSetField(activeInput.exIdx, activeInput.setIdx, 'rpe', newRpe);
                }
              }}
              fieldName={activeInput?.fieldName}
              title={activeInput ? activeExercises[activeInput.exIdx]?.name : ''}
              isRpeMode={isRpeMode}
              onNext={handleNextField}
              onClose={handleCloseKeyboard}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
    <AddExerciseScreen
      visible={isLibraryVisible}
      exercises={exerciseLibrary}
      onConfirm={handleConfirmExercisesFromPicker}
      onClose={() => setIsLibraryVisible(false)}
      onAddCustomExercise={onAddCustomExercise}
      singleSelect={isReplaceMode}
      title={isReplaceMode ? 'REPLACE EXERCISE' : 'ADD EXERCISES'}
    />
    </>
  );
};

interface ActiveSetRowItemProps {
  set: SetRecord;
  setIdx: number;
  exIdx: number;
  activeInput: { exIdx: number; setIdx: number; fieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps'; focusTime?: number } | null;
  onFocus: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps') => void;
  updateSetField: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps' | 'rpe' | 'category' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps', value: string) => void;
  deleteSet: (exIdx: number, setIdx: number) => void;
  toggleSetComplete: (exIdx: number, setIdx: number) => void;
  inputRefs: React.MutableRefObject<{ [key: string]: any }>;
  isPrevCompleted: boolean;
  isNextCompleted: boolean;
  isRpeMode?: boolean;
  tempInputValue?: string;
}

const ActiveSetRowItem: React.FC<ActiveSetRowItemProps> = React.memo(({
  set,
  setIdx,
  exIdx,
  activeInput,
  onFocus,
  updateSetField,
  deleteSet,
  toggleSetComplete,
  inputRefs,
  isPrevCompleted,
  isNextCompleted,
  isRpeMode = true,
  tempInputValue,
}) => {
  const isWeightFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'weight';
  const isRepsFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'reps';

  const isCompleted = set.completed;
  const showPrevConnected = false;
  const showNextConnected = isCompleted && isNextCompleted;

  const rowStyle = {
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.xs,
    borderBottomLeftRadius: radius.xs,
    borderBottomRightRadius: radius.xs,
  };

  // Unilateral set rendering
  if (set.isUnilateral) {
    return (
      <View style={{ marginBottom: showNextConnected ? 0 : 4 }}>
        <SwipeableRow
          onDelete={() => deleteSet(exIdx, setIdx)}
          borderRadius={radius.xs}
          style={rowStyle}
        >
          <View
            style={[
              styles.setRow,
              styles.unilateralSetRow,
              set.completed && styles.setRowCompleted,
              rowStyle,
            ]}
          >
            {/* Set Number / Category Cycle */}
            <Pressable
              style={[
                styles.colSet,
                styles.setNumCol,
                { justifyContent: 'center', alignItems: 'center' }
              ]}
              onPress={() => {
                if (set.completed) return;
                const categories: ('S' | 'W' | 'D' | 'F')[] = ['S', 'W', 'D', 'F'];
                const currIdx = categories.indexOf(set.category || 'S');
                const nextIdx = (currIdx + 1) % categories.length;
                updateSetField(exIdx, setIdx, 'category', categories[nextIdx]);
              }}
              accessibilityLabel={`Cycle set category for set ${setIdx + 1}`}
            >
              <View
                style={[
                  styles.categoryCircle,
                  set.category === 'W' && styles.categoryWarmup,
                  set.category === 'D' && styles.categoryDrop,
                  set.category === 'F' && styles.categoryFailure,
                  set.completed && styles.categoryCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.setNumText,
                    (set.category && set.category !== 'S') && styles.categoryLabelText,
                    (set.category && set.category !== 'S') && { color: set.category === 'W' ? colors.gold : set.category === 'D' ? colors.highlight : colors.error },
                    set.completed && styles.textCompleted,
                  ]}
                >
                  {set.category && set.category !== 'S' ? set.category : (setIdx + 1)}
                </Text>
              </View>
            </Pressable>

            {/* Left/Right Rows Container */}
            <View style={styles.unilateralContainer}>
              {/* Left Row */}
              <View style={styles.unilateralRow}>
                <Text style={styles.unilateralLabel}>L</Text>
                <View style={styles.unilateralInputWrapper}>
                  <TextInput
                    ref={r => { inputRefs.current[`${exIdx}-${setIdx}-leftWeight`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.inputCompleted,
                    ]}
                    showSoftInputOnFocus={false}
                    value={
                      activeInput?.exIdx === exIdx &&
                      activeInput?.setIdx === setIdx &&
                      activeInput?.fieldName === 'leftWeight'
                        ? (tempInputValue ?? '')
                        : String(set.leftWeight || set.weight || '')
                    }
                    onFocus={() => onFocus(exIdx, setIdx, 'leftWeight')}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    editable={!set.completed}
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.unilateralInputWrapper}>
                  <TextInput
                    ref={r => { inputRefs.current[`${exIdx}-${setIdx}-leftReps`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.textCompleted,
                    ]}
                    showSoftInputOnFocus={false}
                    value={
                      activeInput?.exIdx === exIdx &&
                      activeInput?.setIdx === setIdx &&
                      activeInput?.fieldName === 'leftReps'
                        ? (tempInputValue ?? '')
                        : String(set.leftReps || set.reps || '')
                    }
                    onFocus={() => onFocus(exIdx, setIdx, 'leftReps')}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    editable={!set.completed}
                    selectTextOnFocus
                  />
                </View>
              </View>

              {/* Right Row */}
              <View style={styles.unilateralRow}>
                <Text style={styles.unilateralLabel}>R</Text>
                <View style={styles.unilateralInputWrapper}>
                  <TextInput
                    ref={r => { inputRefs.current[`${exIdx}-${setIdx}-rightWeight`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.inputCompleted,
                    ]}
                    showSoftInputOnFocus={false}
                    value={
                      activeInput?.exIdx === exIdx &&
                      activeInput?.setIdx === setIdx &&
                      activeInput?.fieldName === 'rightWeight'
                        ? (tempInputValue ?? '')
                        : String(set.rightWeight || set.weight || '')
                    }
                    onFocus={() => onFocus(exIdx, setIdx, 'rightWeight')}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    editable={!set.completed}
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.unilateralInputWrapper}>
                  <TextInput
                    ref={r => { inputRefs.current[`${exIdx}-${setIdx}-rightReps`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.textCompleted,
                    ]}
                    showSoftInputOnFocus={false}
                    value={
                      activeInput?.exIdx === exIdx &&
                      activeInput?.setIdx === setIdx &&
                      activeInput?.fieldName === 'rightReps'
                        ? (tempInputValue ?? '')
                        : String(set.rightReps || set.reps || '')
                    }
                    onFocus={() => onFocus(exIdx, setIdx, 'rightReps')}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    editable={!set.completed}
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>

            {/* Done Button */}
            <Pressable
              style={({ pressed }) => [
                styles.colCheck,
                styles.checkButton,
                pressed && { transform: [{ scale: 0.96 }] }
              ]}
              onPress={() => toggleSetComplete(exIdx, setIdx)}
            >
              <View
                style={[
                  styles.checkCircle,
                  set.completed && styles.checkCircleCompleted,
                ]}
              >
                <AnimatedCheckmark completed={set.completed} />
              </View>
            </Pressable>
          </View>
        </SwipeableRow>
        {showNextConnected && (
          <View style={{ height: 4, backgroundColor: '#111A2E' }} />
        )}
      </View>
    );
  }

  // Standard bilateral set rendering
  return (
    <View style={{ marginBottom: showNextConnected ? 0 : 4 }}>
      <SwipeableRow
        onDelete={() => deleteSet(exIdx, setIdx)}
        borderRadius={radius.xs}
        style={rowStyle}
      >
        <View
          style={[
            styles.setRow,
            set.completed && styles.setRowCompleted,
            rowStyle,
          ]}
        >
          {/* Set Number / Category Cycle */}
          <Pressable
            style={[
              styles.colSet,
              styles.setNumCol,
              { justifyContent: 'center', alignItems: 'center' }
            ]}
            onPress={() => {
              if (set.completed) return;
              const categories: ('S' | 'W' | 'D' | 'F')[] = ['S', 'W', 'D', 'F'];
              const currIdx = categories.indexOf(set.category || 'S');
              const nextIdx = (currIdx + 1) % categories.length;
              updateSetField(exIdx, setIdx, 'category', categories[nextIdx]);
            }}
            accessibilityLabel={`Cycle set category for set ${setIdx + 1}`}
          >
            <View
              style={[
                styles.categoryCircle,
                set.category === 'W' && styles.categoryWarmup,
                set.category === 'D' && styles.categoryDrop,
                set.category === 'F' && styles.categoryFailure,
                set.completed && styles.categoryCompleted,
              ]}
            >
              <Text
                style={[
                  styles.setNumText,
                  (set.category && set.category !== 'S') && styles.categoryLabelText,
                  (set.category && set.category !== 'S') && { color: set.category === 'W' ? colors.gold : set.category === 'D' ? colors.highlight : colors.error },
                  set.completed && styles.textCompleted,
                ]}
              >
                {set.category && set.category !== 'S' ? set.category : (setIdx + 1)}
              </Text>
            </View>
          </Pressable>

          {/* Weight Input */}
          <View style={[styles.colWeight, styles.inputWrapper]}>
            <TextInput
              ref={r => { inputRefs.current[`${exIdx}-${setIdx}-weight`] = r; }}
              style={[
                styles.input,
                set.completed && styles.inputCompleted,
                isWeightFocused && { borderColor: colors.accent },
              ]}
              showSoftInputOnFocus={false}
              value={
                isWeightFocused
                  ? (tempInputValue ?? '')
                  : String(set.weight || '')
              }
              onFocus={() => onFocus(exIdx, setIdx, 'weight')}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              editable={!set.completed}
              selectTextOnFocus
            />
          </View>

          {/* Reps & RPE Container (Combined UI block) */}
          <View style={[styles.colReps, styles.inputWrapper]}>
            <View
              style={[
                styles.repsRpeContainer,
                set.completed && styles.inputCompleted,
                isRepsFocused && { borderColor: colors.accent },
              ]}
            >
              <TextInput
                ref={r => { inputRefs.current[`${exIdx}-${setIdx}-reps`] = r; }}
                style={[
                  styles.repsInput,
                  set.completed && styles.textCompleted,
                ]}
                showSoftInputOnFocus={false}
                value={
                  isRepsFocused
                    ? (tempInputValue ?? '')
                    : String(set.reps || '')
                }
                onFocus={() => onFocus(exIdx, setIdx, 'reps')}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                editable={!set.completed}
                selectTextOnFocus
              />
              {set.rpe ? (
                <Text style={[styles.rpeInlineText, set.completed && styles.textCompleted]}>
                  {isRpeMode ? `@${set.rpe}` : `${set.rpe}RIR`}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Done Button */}
          <Pressable
            style={({ pressed }) => [
              styles.colCheck,
              styles.checkButton,
              pressed && { transform: [{ scale: 0.96 }] }
            ]}
            onPress={() => toggleSetComplete(exIdx, setIdx)}
          >
            <View
              style={[
                styles.checkCircle,
                set.completed && styles.checkCircleCompleted,
              ]}
            >
              <AnimatedCheckmark completed={set.completed} />
            </View>
          </Pressable>
        </View>
      </SwipeableRow>
      {showNextConnected && (
        <View style={{ height: 4, backgroundColor: '#111A2E' }} />
      )}
    </View>
  );
});


interface ActiveExerciseRowProps {
  exercise: any;
  exIdx: number;
  exItemKey: string;
  isExActive: boolean;
  exDragY: any;
  exItemLayouts: any;
  isSuperSet: boolean;
  nextIsSameSuperSet: boolean;
  prevIsSameSuperSet: boolean;
  superSetColor: string | undefined;
  handleExerciseMenuPress: (idx: number) => void;
  getExerciseDragHandlers: (key: string) => any;
  exerciseLibrary: any;
  activeInput: any;
  handleSetFocus: any;
  updateSetField: any;
  deleteSet: any;
  toggleSetComplete: any;
  inputRefs: any;
  isRpeMode: boolean;
  addSet: (idx: number, unilateral?: boolean) => void;
  tempInputValue?: string;
}

const ActiveExerciseRow: React.FC<ActiveExerciseRowProps> = React.memo(({
  exercise,
  exIdx,
  exItemKey,
  isExActive,
  exDragY,
  exItemLayouts,
  isSuperSet,
  nextIsSameSuperSet,
  prevIsSameSuperSet,
  superSetColor,
  handleExerciseMenuPress,
  getExerciseDragHandlers,
  exerciseLibrary,
  activeInput,
  handleSetFocus,
  updateSetField,
  deleteSet,
  toggleSetComplete,
  inputRefs,
  isRpeMode,
  addSet,
  tempInputValue,
}) => {
  const enterScale = useSharedValue(0.95);
  const enterOpacity = useSharedValue(0);
  const enterTranslateY = useSharedValue(20);

  useEffect(() => {
    enterScale.value = withDelay(
      exIdx * 75,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) })
    );
    enterOpacity.value = withDelay(
      exIdx * 75,
      withTiming(1, { duration: 300 })
    );
    enterTranslateY.value = withDelay(
      exIdx * 75,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) })
    );
  }, [exIdx]);

  const animatedStyle = useAnimatedStyle(() => {
    const dragY = isExActive ? exDragY.value : 0;
    return {
      transform: [
        { translateY: dragY + enterTranslateY.value },
        { scale: isExActive ? 1.02 : enterScale.value }
      ],
      zIndex: isExActive ? 999 : 1,
      opacity: isExActive ? 0.88 : enterOpacity.value,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: isExActive ? 8 : 0 },
      shadowOpacity: isExActive ? 0.55 : 0,
      shadowRadius: isExActive ? 16 : 0,
      elevation: isExActive ? 14 : 0,
    };
  });

  return (
    <Animated.View
      onLayout={e => {
        if (!isExActive) {
          exItemLayouts.current[exItemKey] = {
            y: e.nativeEvent.layout.y,
            height: e.nativeEvent.layout.height,
          };
        }
      }}
      style={animatedStyle}
    >
      <View style={{ marginBottom: spacing.lg }}>
        <View style={[
          styles.exerciseCard,
          isSuperSet && {
            borderLeftWidth: 4,
            borderLeftColor: superSetColor,
          },
          nextIsSameSuperSet && {
            marginBottom: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderBottomWidth: 0,
          },
          prevIsSameSuperSet && {
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }
        ]}>
          <View style={styles.exerciseHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm, flex: 1 }}>
              <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs }}>
              <Pressable
                onPress={() => handleExerciseMenuPress(exIdx)}
                style={styles.exEllipsis}
                android_ripple={rippleTokens.borderless}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </Pressable>
              {/* Drag handle — press-and-hold to reorder */}
              <GestureDetector gesture={getExerciseDragHandlers(exItemKey)}>
                <View
                  style={styles.dragHandle}
                  accessibilityLabel="Drag to reorder exercise"
                >
                  <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
                </View>
              </GestureDetector>
            </View>
          </View>

          {(() => {
            const libEx = exerciseLibrary?.find((e: any) => e.name.toLowerCase() === exercise.name.toLowerCase());
            if (libEx?.notes) {
              return (
                <View style={styles.notesContainer}>
                  <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.notesText} numberOfLines={2}>
                    {libEx.notes}
                  </Text>
                </View>
              );
            }
            return null;
          })()}

          {/* Sets Column Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.columnLabel, styles.colSet]}>SET</Text>
            <Text style={[styles.columnLabel, styles.colWeight, { textAlign: 'center' }]}>KG</Text>
            <Text style={[styles.columnLabel, styles.colReps, { textAlign: 'center' }]}>REPS & RPE</Text>
            <Text style={[styles.columnLabel, styles.colCheck, { textAlign: 'center' }]}>DONE</Text>
          </View>

          {/* Sets Row List */}
          {exercise.sets.map((set: any, setIdx: number) => {
            const isPrevCompleted = setIdx > 0 && exercise.sets[setIdx - 1].completed;
            const isNextCompleted = setIdx < exercise.sets.length - 1 && exercise.sets[setIdx + 1].completed;
            const isActiveRow = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx;
            return (
              <ActiveSetRowItem
                key={set.id}
                set={set}
                setIdx={setIdx}
                exIdx={exIdx}
                activeInput={activeInput}
                onFocus={handleSetFocus}
                updateSetField={updateSetField}
                deleteSet={deleteSet}
                toggleSetComplete={toggleSetComplete}
                inputRefs={inputRefs}
                isPrevCompleted={isPrevCompleted}
                isNextCompleted={isNextCompleted}
                isRpeMode={isRpeMode}
                tempInputValue={isActiveRow ? tempInputValue : undefined}
              />
            );
          })}

          {/* Add Set Button */}
          <Pressable
            style={({ pressed }) => [
              styles.addSetRow,
              pressed && { transform: [{ scale: 0.96 }] }
            ]}
            onPress={() => addSet(exIdx)}
            onLongPress={() => addSet(exIdx, true)}
            android_ripple={rippleTokens.surface}
            accessibilityLabel="Add set, long press for unilateral set"
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addSetText}>ADD SET</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
});


const styles = StyleSheet.create({
  keyboardAvoid: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  modalContainer: {
    flex:            1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    height:            56,
    position:          'relative',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.sm,
  },
  headerStopwatchBtn: {
    minWidth:        36,
    height:          36,
    borderRadius:    radius.xs,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.border,
    paddingHorizontal: 6,
    flexDirection:   'row',
    gap:             4,
  },
  headerTimerBtnActive: {
    borderColor:     colors.accent,
  },
  headerRestTimerText: {
    color:           colors.accent,
    fontSize:        font.sizes.xs,
    fontFamily:      font.bold,
    fontVariant:     ['tabular-nums'],
  },
  timerSubMenu: {
    position:        'absolute',
    top:             56,
    left:            12,
    right:           12,
    zIndex:          1000,
    borderRadius:    26,
    backgroundColor: colors.surface,
    ...(shadow.card as object),
  },

  minimizeBtn: {
    padding: spacing.xs,
  },
  headerCenter: {
    position:       'absolute',
    left:           0,
    right:          0,
    top:            0,
    bottom:         0,
    justifyContent: 'center',
    alignItems:     'center',
    zIndex:         -1,
  },
  headerTimerText: {
    color:      colors.accent,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  headerFinishBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   colors.accent,
    borderRadius:      radius.full,
    width:             36,
    height:            36,
    ...(shadow.accentGlow as object),
  },

  // Main Scroll View Workout Title Section
  workoutTitleSection: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    marginBottom:      spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  workoutTitleText: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.xl,
    fontFamily: font.bold,
  },
  workoutTitleInput: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.xl,
    fontFamily: font.bold,
    flex: 1,
    marginRight: spacing.md,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  workoutTitleOptionsBtn: {
    padding: spacing.xs,
  },

  // Scroll Container
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding:       spacing.lg,
  },
  emptyContainer: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 80,
    rowGap:         spacing.md,
  },
  emptyText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.base,
    fontFamily: font.medium,
  },

  // Exercise Card
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    ...(shadow.sm as object),
  },
  exerciseHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  exerciseName: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
  },
  superSetBadge: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  superSetBadgeText: {
    color: colors.accent,
    fontSize: 9,
    fontFamily: font.bold,
  },
  exEllipsis: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -10,
  },

  // Table Headers
  tableHeader: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
  },
  columnLabel: {
    color:      colors.textSecondary,
    fontSize:   10,
    fontFamily: font.semibold,
  },

  // Columns Layout
  colSet: {
    width:      48,
    textAlign:  'center',
  },
  colWeight: {
    flex:       1.1,
    marginRight: spacing.sm,
  },
  colReps: {
    flex:       1.1,
    marginRight: spacing.sm,
  },
  colCheck: {
    width:      50,
    alignItems: 'center',
  },

  // Set Row
  setRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 6,
    borderRadius:    radius.xs,
    backgroundColor: colors.surface,
  },
  setRowCompleted: {
    backgroundColor: '#111A2E',
  },
  unilateralSetRow: {
    flexDirection:   'row',
    alignItems:      'stretch',
    paddingVertical: 0,
    borderRadius:    radius.xs,
    backgroundColor: colors.surface,
  },
  unilateralContainer: {
    flex:            1,
    flexDirection:   'column',
    gap:             2,
    paddingVertical: 4,
  },
  unilateralRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
  },
  unilateralLabel: {
    width:           20,
    color:           colors.textSecondary,
    fontSize:        font.sizes.xs,
    fontFamily:      font.bold,
    textAlign:       'center',
  },
  unilateralInputWrapper: {
    flex:            1,
    height:          28,
  },
  unilateralInput: {
    flex:            1,
    backgroundColor: colors.surface2,
    borderColor:     colors.border,
    borderWidth:     1,
    borderRadius:    radius.xs,
    color:           colors.textPrimary,
    textAlign:       'center',
    fontSize:        font.sizes.sm,
    fontFamily:      'monospace',
    padding:         0,
  },
  setNumCol: {
    height:         32,
    justifyContent: 'center',
    alignItems:     'center',
  },
  setNumText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.semibold,
  },
  inputWrapper: {
    height: 32,
  },
  input: {
    flex:            1,
    backgroundColor: colors.surface2,
    borderColor:     colors.border,
    borderWidth:     1,
    borderRadius:    radius.xs,
    color:           colors.textPrimary,
    textAlign:       'center',
    fontSize:        font.sizes.sm,
    fontFamily:      'monospace',
    padding:         0,
  },
  inputCompleted: {
    backgroundColor: 'rgba(22, 27, 36, 0.3)',
    borderColor:     colors.border,
    color:           colors.textMuted,
    textDecorationLine: 'line-through',
  },
  textCompleted: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },

  // Check Button
  checkButton: {
    height:         40,
    justifyContent: 'center',
  },
  checkCircle: {
    width:           20,
    height:          20,
    borderRadius:    6,
    borderWidth:     1.5,
    borderColor:     colors.borderStrong,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'transparent',
  },
  checkCircleCompleted: {
    borderColor:     colors.accent,
    backgroundColor: colors.accent,
  },

  // Add Set Row
  addSetRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    columnGap:       4,
    paddingVertical: spacing.sm,
    marginTop:       spacing.xs,
    borderColor:     colors.border,
    borderTopWidth:  1,
    borderStyle:     'dashed',
  },
  addSetText: {
    color:      colors.accent,
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
  },

  // Scroll Discard Button
  scrollDiscardBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.surface,
    borderColor:     colors.border,
    borderWidth:     1,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    marginBottom:    spacing.xl,
  },
  scrollDiscardText: {
    color:         colors.error,
    fontSize:      font.sizes.sm,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },

  // Redesigned Rest Timer floating pill
  timerPillWidget: {
    position: 'absolute',
    bottom: 24,
    left: '8%',
    right: '8%',
    backgroundColor: 'rgba(22, 27, 36, 0.95)',
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...(shadow.lg as object),
  },
  timerPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  timerPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerPillTime: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
    minWidth: 42,
  },
  timerPillDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
  timerPillAdjustments: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
  },
  timerPillAdjBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 30,
    justifyContent: 'center',
  },
  timerPillAdjText: {
    color: colors.accent,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  timerPillSkipBtn: {
    padding: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 32,
  },

  // Exercise library picker
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    maxHeight: '80%',
    ...(shadow.lg as object),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    height: 40,
    paddingHorizontal: spacing.md,
    columnGap: spacing.xs,
    marginBottom: spacing.md,
  },
  librarySearchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    height: '100%',
    padding: 0,
  },
  libraryList: {
    flex: 1,
  },
  libraryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  libraryItemText: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  libraryMuscleText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: font.bold,
  },

  // Ellipsis sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    rowGap: spacing.md,
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  sheetDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  sheetTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    paddingVertical: spacing.md,
  },
  sheetItemText: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
  },
  sheetCancel: {
    marginTop: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color: colors.textSecondary,
    fontSize: font.sizes.base,
    fontFamily: font.semibold,
  },

  // Set Category Styling
  categoryCircle: {
    width:           28,
    height:          28,
    borderRadius:    radius.xs,
    justifyContent:  'center',
    alignItems:      'center',
    alignSelf:       'center',
    backgroundColor: colors.surface2,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  categoryWarmup: {
    backgroundColor: colors.goldGlow,
    borderColor:     colors.gold,
  },
  categoryDrop: {
    backgroundColor: colors.highlightGlow,
    borderColor:     colors.highlight,
  },
  categoryFailure: {
    backgroundColor: colors.errorGlow,
    borderColor:     colors.error,
  },
  categoryCompleted: {
    opacity:         0.6,
  },
  categoryLabelText: {
    fontFamily: font.bold,
  },

  // Plate Calculator Styling
  plateCalcBody: {
    rowGap: spacing.md,
    marginTop: spacing.sm,
  },
  barWeightToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plateCalcLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  barWeightToggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.xs,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xs - 2,
  },
  barToggleBtnActive: {
    backgroundColor: colors.surface,
  },
  barToggleText: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  barToggleTextActive: {
    color: colors.accent,
  },
  plateCalcInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    padding: spacing.md,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  visualBarbellContainer: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
    rowGap: spacing.md,
  },
  plateCalcSectionTitle: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  emptyPlatesBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlatesText: {
    color: colors.textMuted,
    fontSize: font.sizes.sm,
    fontStyle: 'italic',
  },
  platesDisplay: {
    rowGap: spacing.lg,
  },
  barbellSleeveVisual: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    justifyContent: 'center',
  },
  sleeveBarLine: {
    position: 'absolute',
    height: 12,
    backgroundColor: '#4A5568',
    left: '10%',
    right: 0,
    borderRadius: 3,
    zIndex: 1,
  },
  sleeveStop: {
    width: 14,
    height: 94,
    backgroundColor: '#2D3748',
    borderRadius: 4,
    position: 'absolute',
    left: '10%',
    zIndex: 3,
  },
  stackedPlatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: '13%',
    zIndex: 4,
  },
  visualPlate: {
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
  },
  visualPlateText: {
    fontFamily: font.bold,
  },
  platesTextLegend: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    rowGap: 4,
  },
  legendTextLine: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  modalBtnCancel: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSave: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    color: colors.textSecondary,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
  },
  modalBtnSaveText: {
    color: colors.textInverse,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
  },
  noteModalHeader: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  exerciseNotesText: {
    color: colors.gold,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    marginTop: 4,
    paddingHorizontal: spacing.xs,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    gap: 6,
  },
  notesText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    flex: 1,
  },

  // Fallback and Custom Exercise Form Styles
  fallbackContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.textSecondary,
    fontSize: font.sizes.md,
    fontFamily: font.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  fallbackBtn: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  fallbackBtnText: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
    textAlign: 'center',
  },
  customFormContainer: {
    paddingVertical: spacing.sm,
    rowGap: spacing.xs,
  },
  formSectionTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs - 1,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    padding: spacing.md,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  formScroll: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  formChip: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginRight: spacing.sm,
  },
  formChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  formChipText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  formChipTextActive: {
    color: colors.accent,
    fontFamily: font.bold,
  },
  formBtnRow: {
    flexDirection: 'row',
    columnGap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  formBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBtnCancel: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
  },
  formBtnSave: {
    backgroundColor: colors.accent,
  },
  formBtnCancelText: {
    color: colors.textSecondary,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
  },
  formBtnSaveText: {
    color: colors.textInverse,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
  },

  // Reps & RPE Combined block styles
  repsRpeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    position: 'relative',
    height: 32,
    paddingHorizontal: spacing.sm,
  },
  repsInput: {
    flex: 1,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: font.sizes.sm,
    fontFamily: 'monospace',
    padding: 0,
    height: '100%',
  },
  rpeInlineText: {
    position: 'absolute',
    right: 6,
    color: colors.violet,
    fontSize: 10,
    fontFamily: font.bold,
  },
  // Custom Timer Picker styles (adapted from ProfileScreen)
  bottomSheetOptions: {
    rowGap: spacing.sm,
    marginBottom: spacing.lg,
  },
  soundOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 52,
  },
  soundOptionRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
  },
  soundOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  soundOptionText: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  soundOptionTextActive: {
    color: colors.accent,
    fontFamily: font.semibold,
  },
  customTimerContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  customTimerTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  customTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  customTimerInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },
  customTimerBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTimerBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
  },
  bottomSheetCloseBtn: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderColor: colors.border,
    borderWidth: 1,
  },
  bottomSheetCloseBtnText: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
});

export default ActiveWorkoutModal;
