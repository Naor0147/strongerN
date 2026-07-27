// components/layout/ActiveWorkoutModal.tsx
// Premium full-featured active workout tracking screen (Layout Optimized)
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence, runOnJS, Easing, cancelAnimation, withDelay, useAnimatedRef } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as RN from 'react-native';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  setForegroundSuppression,
  scheduleRestTimerNotification,
  cancelRestTimerNotification,
  showWorkoutBackgroundNotification,
  dismissWorkoutBackgroundNotification,
} from '../../utils/notifications';
import {
  startWorkoutForeground,
  updateTimerCountdown,
  showTimerComplete,
  stopWorkoutForeground,
} from '../../utils/foregroundNotification';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../utils/i18n';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../../theme';
import { ExerciseSet } from '../../data/mockData';
import IconButton from '../ui/IconButton';
import { CustomWorkoutKeyboard } from '../ui/CustomWorkoutKeyboard';
import { SetInputCell } from '../ui/SetInputCell';
import { playSetCheckedSound, playTimerCompletedSound, playWorkoutCompletedSound, playSatisfyingClickFinishSet, playSatisfyingClickStopTimer, playUncheckSetSound } from '../../utils/soundPlayer';
import AddExerciseScreen from '../../screens/AddExerciseScreen';
import ExerciseInsightsModal from '../../screens/ExerciseInsightsModal';
import RestTimerRuler from '../ui/RestTimerRuler';
import RestTimerPicker from '../ui/RestTimerPicker';
import Card from '../ui/Card';
import { SwipeableRow as SharedSwipeableRow } from './SwipeableRow';
import Sortable from 'react-native-sortables';
import { useExerciseRowGestures } from '../ui/gestureCoexistence';
import { ElapsedTimeText } from '../ui/ElapsedTimeText';
import { saveCrashLogSync } from '../../utils/crashLogger';
import { keyboardValueStore } from '../../utils/keyboardValueStore';
import { activeInputStore } from '../../utils/activeInputStore';
import { useTrackRender } from '../../utils/renderTracker';
import { VariationDropdown } from '../ui/VariationDropdown';
import { getSessionsForExerciseVariation } from '../../utils/variationUtils';
import { styles } from './activeWorkoutStyles';


import { SetSuggestion, SetRecord, ActiveExercise, ActiveWorkoutModalProps } from './activeWorkoutTypes';
import { safeLayoutAnim, WebSafeAlert, EMPTY_ARRAY, EMPTY_OBJECT, formatElapsed, getBestPerformanceSuggestionForSet, getPreviousSessionSetSuggestion, serializeState, sanitizeSuperSets } from './activeWorkoutUtils';
import { restTimerEmitter, RestTimerEmitter } from './restTimerEmitter';
import { AnimatedCheckmark } from './AnimatedCheckmark';
import { RestTimerHeaderButton, RestTimerRulerContainer } from './RestTimerHeaderControls';
import { ActiveWorkoutKeyboardWrapper } from './ActiveWorkoutKeyboardWrapper';
import { ActiveSetRowItem, ActiveSetRowItemProps } from './ActiveSetRowItem';
import { ActiveExerciseRow, ActiveExerciseRowProps } from './ActiveExerciseRow';
import { ActiveExerciseCard, ActiveExerciseCardProps } from './ActiveExerciseCard';
import { useRestTimerController } from '../../hooks/useRestTimerController';

















const SwipeableRow = SharedSwipeableRow;
















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
  onUpdateExerciseInsightsNotes,
  onUpdateExerciseVariations,
  onAddCustomExercise,
  isLiveHeartRateEnabled = false,

  defaultRestDuration = 90,
  onRenameWorkout,
  sessions = EMPTY_ARRAY,
  isProgressiveOverloadEnabled = false,
  isAutoFinishSetEnabled = true,

  isRpeMode = true,
  exerciseNameLanguage,
  isEditing = false,
  previousDurationMin = 0,
  editingComment,
  onUpdateComment,
  onUpdateStartTime,
  onUpdateDefaultRestDuration,
  onUpdateExercise,
}) => {
  const { startTimer, stopTimer, adjustTimer } = useRestTimerController({ defaultRestDuration });
  useTrackRender('ActiveWorkoutModal');
  const insets = useSafeAreaInsets();
  // Track the actual resume/edit start time (when THIS session started, not the original workout)
  const resumeStartTime = useRef(isEditing ? new Date() : (startTime || new Date()));
  // Offset in seconds from previous session duration (for edit/resume)
  const accumulatedOffsetSeconds = useRef((previousDurationMin || 0) * 60);
  const initialStateRef = useRef<{ exercises: string; note: string }>({ exercises: '', note: '' });
  const wasInitializedRef = useRef(false);
  // Workout menu state
  const [isWorkoutMenuVisible, setIsWorkoutMenuVisible] = useState(false);
  const [workoutNote, setWorkoutNote] = useState(editingComment || '');
  const [isWorkoutNoteModalVisible, setIsWorkoutNoteModalVisible] = useState(false);
  const [isStartTimePickerVisible, setIsStartTimePickerVisible] = useState(false);
  const [editedStartTimeText, setEditedStartTimeText] = useState('');
  const [isDefaultTimerPickerVisible, setIsDefaultTimerPickerVisible] = useState(false);
  const [localDefaultRest, setLocalDefaultRest] = useState(defaultRestDuration);
  const [customDefaultTimerValue, setCustomDefaultTimerValue] = useState('');
  const [activeExercises, _setActiveExercises] = useState<ActiveExercise[]>([]);
  const activeExercisesRef = useRef<ActiveExercise[]>([]);
  const hasSyncedPropsRef = useRef(false);
  const flushExercisesToParentRef = useRef<(exs: ActiveExercise[]) => void>(() => {});

  const setActiveExercises = useCallback((action: React.SetStateAction<ActiveExercise[]>) => {
    const current = activeExercisesRef.current;
    const next = typeof action === 'function' ? (action as (p: ActiveExercise[]) => ActiveExercise[])(current) : action;
    activeExercisesRef.current = next;
    _setActiveExercises(next);
    if (hasSyncedPropsRef.current && flushExercisesToParentRef.current) {
      flushExercisesToParentRef.current(next);
    }
  }, []);

  const [localWorkoutName, setLocalWorkoutName] = useState(workoutName);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const tempInputValueRef = useRef('');
  const activeInputRef = useRef<{
    exIdx: number;
    setIdx: number;
    fieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
    focusTime?: number;
  } | null>(null);

  useLayoutEffect(() => {
    return activeInputStore.subscribe((input: any) => {
      if (input !== null) {
        try {
          if (typeof performance !== 'undefined' && typeof performance.mark === 'function' && typeof performance.measure === 'function') {
            performance.mark('focus-end');
            performance.measure('Focus Transition Time', 'focus-start', 'focus-end');
            const measures = performance.getEntriesByName('Focus Transition Time');
            if (measures.length > 0) {
              const duration = measures[measures.length - 1].duration;
              console.log(`[BENCHMARK] Focus transition took: ${duration.toFixed(2)}ms`);
            }
            performance.clearMarks('focus-start');
            performance.clearMarks('focus-end');
            performance.clearMeasures('Focus Transition Time');
          }
        } catch (e) {}
      }
    });
  }, []);

  useEffect(() => {
    setForegroundSuppression(visible);
  }, [visible]);

  const inputRefs = useRef<{ [key: string]: any }>({});

  // Auto rest timer countdown states
  const [isTimerSubMenuVisible, setIsTimerSubMenuVisible] = useState(false);

  // Exercise library selector modal states
  const [isLibraryVisible, setIsLibraryVisible] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeExerciseMenuIndex, setActiveExerciseMenuIndex] = useState<number | null>(null);
  const [isExMenuVisible, setIsExMenuVisible] = useState(false);
  const [isTimerPickerVisible, setIsTimerPickerVisible] = useState(false);
  const [autoTimerDraft, setAutoTimerDraft] = useState<number>(defaultRestDuration);
  const [isExerciseInsightsVisible, setIsExerciseInsightsVisible] = useState(false);
  const [isReplaceMode, setIsReplaceMode] = useState(false);

  const mountedRef = useRef(true);

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
            if (!mountedRef.current) return;
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
            if (!mountedRef.current) return;
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

  // PanResponder for Default Timer bottom sheet
  const defaultTimerPanResponder = useRef(
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
            if (!mountedRef.current) return;
            setIsDefaultTimerPickerVisible(false);
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
            if (!mountedRef.current) return;
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
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { width: windowWidth } = useWindowDimensions();
  const [listWidth, setListWidth] = useState(windowWidth - spacing.lg * 2);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setListWidth(windowWidth - spacing.lg * 2);
  }, [windowWidth]);



  const exerciseLibraryMap = useMemo(() => {
    const map = new Map<string, any>();
    if (exerciseLibrary) {
      for (let i = 0; i < exerciseLibrary.length; i++) {
        const item = exerciseLibrary[i];
        if (item && item.name) {
          map.set(item.name.toLowerCase(), item);
        }
      }
    }
    return map;
  }, [exerciseLibrary]);

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

  const sessionsByExerciseMap = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!sessions) return map;
    try {
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (s && s.exercises && Array.isArray(s.exercises)) {
          for (let j = 0; j < s.exercises.length; j++) {
            const ex = s.exercises[j];
            if (ex && ex.name && typeof ex.name === 'string') {
              const key = ex.name.trim().toLowerCase();
              let list = map.get(key);
              if (!list) {
                list = [];
                map.set(key, list);
              }
              list.push({ datetime: s.datetime, ex });
            }
          }
        }
      }
      map.forEach(list => {
        list.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
      });
    } catch (e) {
      console.warn('[sessionsByExerciseMap] Error building sessions map:', e);
    }
    return map;
  }, [sessions]);

  const [renderedCardLimit, setRenderedCardLimit] = useState(4);

  useEffect(() => {
    if (visible) {
      setRenderedCardLimit(4);
      let currentLimit = 4;
      let animId: number;

      const expandChunk = () => {
        if (currentLimit < exercises.length) {
          currentLimit = Math.min(exercises.length, currentLimit + 8);
          setRenderedCardLimit(currentLimit);
          if (currentLimit < exercises.length) {
            animId = requestAnimationFrame(expandChunk);
          }
        }
      };

      animId = requestAnimationFrame(expandChunk);
      return () => {
        if (animId) cancelAnimationFrame(animId);
      };
    }
  }, [visible, exercises.length]);

  const lastStartTimeRef = useRef<string | null>(null);

  // Sync props to state when modal becomes visible
  useEffect(() => {
    if (visible) {
      const validStartTime = startTime instanceof Date ? startTime : (startTime ? new Date(startTime) : new Date());
      const safeStart = isNaN(validStartTime.getTime()) ? new Date() : validStartTime;
      const startKey = safeStart.toISOString();
      const isNewWorkout = lastStartTimeRef.current !== startKey;

      if (!wasInitializedRef.current || isNewWorkout) {
        if (isNewWorkout && lastStartTimeRef.current !== null) {
          restTimerEmitter.stop();
        }
        lastStartTimeRef.current = startKey;
        wasInitializedRef.current = true;

        // Reset timer refs and note state on a fresh track/edit session start
        resumeStartTime.current = isEditing ? new Date() : safeStart;
        accumulatedOffsetSeconds.current = (previousDurationMin || 0) * 60;
        setWorkoutNote(editingComment || '');
        setLocalWorkoutName(workoutName);        const initial = (exercises || [])
          .filter((ex: ExerciseSet) => Boolean(ex && ex.name && typeof ex.name === 'string'))
          .map((ex: ExerciseSet, exIdx): ActiveExercise => {
          const setsCount = ex.sets;
          const useRoutineTargets = (ex as any).useRoutineTargets || false;
          const existingDetails = ex.setsDetails;
          if (existingDetails && existingDetails.length > 0) {
            return {
              id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
              name: ex.name,
              note: (ex as any).note,
              variation: (ex as any).variation,
              sets: existingDetails.map((s: any, sIdx: number) => {
                const isUnilateral = s.isUnilateral || false;
                const completed = s.completed || false;
                const category = s.category || 'S';

                let suggestedWeight = '';
                let suggestedReps = '';
                let suggestedLeftWeight = '';
                let suggestedLeftReps = '';
                let suggestedRightWeight = '';
                let suggestedRightReps = '';

                if (useRoutineTargets) {
                  suggestedWeight = s.suggestedWeight?.toString() || (s.weight && s.weight !== '0' ? s.weight.toString() : '');
                  suggestedReps = s.suggestedReps?.toString() || (s.reps && s.reps !== '0' ? s.reps.toString() : '');
                  if (isUnilateral) {
                    suggestedLeftWeight = s.suggestedLeftWeight?.toString() || (s.leftWeight && s.leftWeight !== '0' ? s.leftWeight.toString() : suggestedWeight);
                    suggestedLeftReps = s.suggestedLeftReps?.toString() || (s.leftReps && s.leftReps !== '0' ? s.leftReps.toString() : suggestedReps);
                    suggestedRightWeight = s.suggestedRightWeight?.toString() || (s.rightWeight && s.rightWeight !== '0' ? s.rightWeight.toString() : suggestedWeight);
                    suggestedRightReps = s.suggestedRightReps?.toString() || (s.rightReps && s.rightReps !== '0' ? s.rightReps.toString() : suggestedReps);
                  }
                } else {
                  let hist: SetSuggestion = { weight: '', reps: '', leftWeight: '', leftReps: '', rightWeight: '', rightReps: '' };
                  try {
                    hist = getPreviousSessionSetSuggestion(ex.name, category, sIdx, sessions, isUnilateral, undefined, undefined, sessionsByExerciseMap);
                  } catch (err) {
                    console.warn('[ActiveWorkout] Error getting previous set suggestion:', err);
                  }
                  if (hist.weight || hist.reps || hist.leftWeight || hist.rightWeight) {
                    suggestedWeight = hist.weight;
                    suggestedReps = hist.reps;
                    suggestedLeftWeight = hist.leftWeight || '';
                    suggestedLeftReps = hist.leftReps || '';
                    suggestedRightWeight = hist.rightWeight || '';
                    suggestedRightReps = hist.rightReps || '';
                  } else {
                    suggestedWeight = s.suggestedWeight?.toString() || (s.weight && s.weight !== '0' ? s.weight.toString() : '');
                    suggestedReps = s.suggestedReps?.toString() || (s.reps && s.reps !== '0' ? s.reps.toString() : '');
                    if (isUnilateral) {
                      suggestedLeftWeight = s.suggestedLeftWeight?.toString() || (s.leftWeight && s.leftWeight !== '0' ? s.leftWeight.toString() : suggestedWeight);
                      suggestedLeftReps = s.suggestedLeftReps?.toString() || (s.leftReps && s.leftReps !== '0' ? s.leftReps.toString() : suggestedReps);
                      suggestedRightWeight = s.suggestedRightWeight?.toString() || (s.rightWeight && s.rightWeight !== '0' ? s.rightWeight.toString() : suggestedWeight);
                      suggestedRightReps = s.suggestedRightReps?.toString() || (s.rightReps && s.rightReps !== '0' ? s.rightReps.toString() : suggestedReps);
                    }
                  }
                }

                return {
                  id:           `set-${exIdx}-${sIdx}-${Date.now()}`,
                  weight:       s.weight !== undefined && s.weight !== null ? s.weight.toString() : '',
                  reps:         s.reps !== undefined && s.reps !== null ? s.reps.toString() : '',
                  completed:    completed,
                  rpe:          s.rpe !== undefined && s.rpe !== null ? s.rpe.toString() : '',
                  category:     (category) as 'W' | 'S' | 'D' | 'F',
                  isUnilateral: isUnilateral,
                  leftWeight:   isUnilateral ? (s.leftWeight !== undefined && s.leftWeight !== null ? s.leftWeight.toString() : '') : undefined,
                  leftReps:     isUnilateral ? (s.leftReps !== undefined && s.leftReps !== null ? s.leftReps.toString() : '') : undefined,
                  rightWeight:  isUnilateral ? (s.rightWeight !== undefined && s.rightWeight !== null ? s.rightWeight.toString() : '') : undefined,
                  rightReps:    isUnilateral ? (s.rightReps !== undefined && s.rightReps !== null ? s.rightReps.toString() : '') : undefined,
                  suggestedWeight,
                  suggestedReps,
                  suggestedLeftWeight: isUnilateral ? suggestedLeftWeight : undefined,
                  suggestedLeftReps: isUnilateral ? suggestedLeftReps : undefined,
                  suggestedRightWeight: isUnilateral ? suggestedRightWeight : undefined,
                  suggestedRightReps: isUnilateral ? suggestedRightReps : undefined,
                };
              }),
              superSetGroupId: (ex as any).superSetGroupId,
            };
          }
 
           return {
             id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
             name: ex.name,
             note: (ex as any).note,
             variation: (ex as any).variation,
             sets: Array.from({ length: setsCount }).map((_, setIdx) => {
               const isUnilateral = ex.setsDetails?.[0]?.isUnilateral || false;
               const category = 'S';
               let hist: SetSuggestion = { weight: '', reps: '', leftWeight: '', leftReps: '', rightWeight: '', rightReps: '' };
               try {
                 hist = getPreviousSessionSetSuggestion(ex.name, category, setIdx, sessions, isUnilateral, undefined, undefined, sessionsByExerciseMap);
               } catch (err) {
                 console.warn('[ActiveWorkout] Error getting previous set suggestion:', err);
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
                 suggestedWeight: hist.weight,
                 suggestedReps: hist.reps,
                 suggestedLeftWeight: isUnilateral ? hist.leftWeight : undefined,
                 suggestedLeftReps: isUnilateral ? hist.leftReps : undefined,
                 suggestedRightWeight: isUnilateral ? hist.rightWeight : undefined,
                 suggestedRightReps: isUnilateral ? hist.rightReps : undefined,
               };
             }),
             superSetGroupId: (ex as any).superSetGroupId,
           };
         }).filter((ex): ex is ActiveExercise => Boolean(ex));
        setActiveExercises(initial);

        // Capture initial state asynchronously to avoid un-blocking mount frame
        setTimeout(() => {
          initialStateRef.current = {
            exercises: serializeState(initial, editingComment || ''),
            note: editingComment || ''
          };
        }, 50);

        hasSyncedPropsRef.current = true;
      }
    }
  }, [visible, startTime, exercises, previousDurationMin, editingComment, sessionsByExerciseMap]);

  const debounceSyncRef = useRef<NodeJS.Timeout | null>(null);

  const flushExercisesToParent = useCallback((exs: ActiveExercise[]) => {
    if (debounceSyncRef.current) {
      clearTimeout(debounceSyncRef.current);
    }
    if (onUpdateActiveExercises) {
      const mapped = exs.map(ex => {
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
          note: ex.note,
          variation: ex.variation,
          sets: ex.sets.length,
          bestWeight: allWeights.length > 0 ? Math.max(...allWeights, 0) : 0,
          bestReps: allReps.length > 0 ? Math.max(...allReps, 0) : 0,
          superSetGroupId: ex.superSetGroupId,
          setsDetails: ex.sets.map(s => ({
            weight: s.weight !== undefined ? s.weight : '',
            reps: s.reps !== undefined ? s.reps : '',
            suggestedWeight: (s as any).suggestedWeight,
            suggestedReps: (s as any).suggestedReps,
            completed: s.completed,
            rpe: s.rpe ? s.rpe : undefined,
            category: s.category || 'S',
            isUnilateral: s.isUnilateral || false,
            leftWeight: s.leftWeight !== undefined ? s.leftWeight : undefined,
            leftReps: s.leftReps !== undefined ? s.leftReps : undefined,
            rightWeight: s.rightWeight !== undefined ? s.rightWeight : undefined,
            rightReps: s.rightReps !== undefined ? s.rightReps : undefined,
          })),
        };
      });
      onUpdateActiveExercises(mapped);
    }
  }, [onUpdateActiveExercises]);

  useEffect(() => {
    flushExercisesToParentRef.current = flushExercisesToParent;
  }, [flushExercisesToParent]);

  // Sync active exercises back to parent App state so they are stored
  useEffect(() => {
    if (!hasSyncedPropsRef.current) return;
    flushExercisesToParent(activeExercises);
  }, [activeExercises, flushExercisesToParent]);

  // Web beforeunload listener to flush active exercises immediately
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleBeforeUnload = () => {
      if (hasSyncedPropsRef.current) {
        flushExercisesToParent(activeExercisesRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushExercisesToParent]);

  // Keep refs of values needed by background notifications
  const localWorkoutNameRef = useRef(localWorkoutName);
  useEffect(() => {
    localWorkoutNameRef.current = localWorkoutName;
  }, [localWorkoutName]);

  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    let restTimerUnsubscribe: (() => void) | null = null;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      try {
        if (nextAppState === 'active') {
          if (restTimerUnsubscribe) {
            try { restTimerUnsubscribe(); } catch (e) {}
            restTimerUnsubscribe = null;
          }
          await stopWorkoutForeground().catch((err) => console.warn('[ForegroundNotif] stop error:', err));
          await dismissWorkoutBackgroundNotification().catch((err) => console.warn('[Notif] dismiss error:', err));
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          if (activeInputRef.current) {
            try {
              updateSetField(activeInputRef.current.exIdx, activeInputRef.current.setIdx, activeInputRef.current.fieldName, tempInputValueRef.current);
            } catch (e) {}
          }
          if (hasSyncedPropsRef.current) {
            try {
              flushExercisesToParent(activeExercisesRef.current);
            } catch (e) {}
          }
          if (visibleRef.current) {
            const workoutNameStr = localWorkoutNameRef.current || 'Workout';
            await startWorkoutForeground(workoutNameStr).catch((err) => console.warn('[ForegroundNotif] start error:', err));

            const initialActive = restTimerEmitter.isActive();
            const initialRemaining = restTimerEmitter.getRemaining();

            const buildWorkoutBody = (timerActive: boolean, timerRemaining: number, timerJustFinished: boolean) => {
              const currentExerciseName = (activeExercisesRef.current && activeExercisesRef.current.length > 0 && activeExercisesRef.current[0]?.name)
                ? activeExercisesRef.current[0].name
                : 'Workout in Progress';
              const elapsedStr = formatElapsed(resumeStartTime.current, accumulatedOffsetSeconds.current);
              if (timerJustFinished) {
                return `${currentExerciseName} • ${elapsedStr} • Rest complete — next set ready`;
              }
              return `${currentExerciseName} • ${elapsedStr}${timerActive ? ` • Rest: ${timerRemaining}s` : ''}`;
            };

            const initialBody = buildWorkoutBody(initialActive, initialRemaining, false);
            await showWorkoutBackgroundNotification({
              title: workoutNameStr,
              body: initialBody,
            }).catch(() => {});

            if (restTimerUnsubscribe) {
              try { restTimerUnsubscribe(); } catch (e) {}
            }

            let prevActive = initialActive;
            let prevRemaining = initialRemaining;

            restTimerUnsubscribe = restTimerEmitter.subscribe(async (timerState) => {
              try {
                const activeFlips = timerState.active !== prevActive;
                const remainingHitsZero = timerState.remaining === 0 && prevRemaining > 0;

                if (timerState.active && timerState.remaining > 0) {
                  await updateTimerCountdown(timerState.remaining, workoutNameStr).catch(() => {});
                }

                if (activeFlips || remainingHitsZero) {
                  const timerJustFinished = !timerState.active && prevActive;
                  if (timerJustFinished) {
                    await showTimerComplete(workoutNameStr).catch(() => {});
                  }

                  const body = buildWorkoutBody(timerState.active, timerState.remaining, timerJustFinished);
                  await showWorkoutBackgroundNotification({
                    title: workoutNameStr,
                    body,
                  }).catch(() => {});
                }

                prevActive = timerState.active;
                prevRemaining = timerState.remaining;
              } catch (e) {
                console.warn('[ActiveWorkout] Error in restTimerEmitter background subscriber:', e);
              }
            });
          }
        }
      } catch (e) {
        console.error('[AppState Error in ActiveWorkoutModal]:', e);
      }
    });

    return () => {
      subscription.remove();
      if (restTimerUnsubscribe) {
        try { restTimerUnsubscribe(); } catch (e) {}
      }
      stopWorkoutForeground().catch(() => {});
      dismissWorkoutBackgroundNotification().catch(() => {});
    };
  }, []);

  // Set weight/reps/rpe/category updater
  const updateSetField = useCallback((exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'rpe' | 'category' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps', value: string) => {
    const currentVal = activeExercisesRef.current[exIdx]?.sets[setIdx]?.[field] ?? '';
    if (String(currentVal) === value && field !== 'category') return;

    setActiveExercises(prev => {
      if (!prev[exIdx]) return prev;
      const targetEx = prev[exIdx];
      if (!targetEx.sets[setIdx]) return prev;

      const targetSet = targetEx.sets[setIdx];
      const updatedSet = { ...targetSet, [field]: value };
      if (field === 'weight') (updatedSet as any).weightSuggested = false;
      else if (field === 'reps') (updatedSet as any).repsSuggested = false;
      else if (field === 'leftWeight') (updatedSet as any).leftWeightSuggested = false;
      else if (field === 'leftReps') (updatedSet as any).leftRepsSuggested = false;
      else if (field === 'rightWeight') (updatedSet as any).rightWeightSuggested = false;
      else if (field === 'rightReps') (updatedSet as any).rightRepsSuggested = false;

      const nextSets = [...targetEx.sets];
      nextSets[setIdx] = updatedSet;

      if (field === 'category') {
        const setsWithCategory = nextSets.map((s, sIdx) => {
          const category = s.category || 'S';
          let positionInCategory = 0;
          for (let i = 0; i < sIdx; i++) {
            if ((nextSets[i].category || 'S') === category) {
              positionInCategory++;
            }
          }
          let suggested: SetSuggestion = {
            weight: '60',
            reps: '10',
            leftWeight: '60',
            leftReps: '10',
            rightWeight: '60',
            rightReps: '10',
          };
          if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
            suggested = getBestPerformanceSuggestionForSet(targetEx.name, category, positionInCategory, sessions, s.isUnilateral || false);
          }
          return {
            ...s,
            suggestedWeight: suggested.weight,
            suggestedReps: suggested.reps,
            suggestedLeftWeight: s.isUnilateral ? suggested.leftWeight : undefined,
            suggestedLeftReps: s.isUnilateral ? suggested.leftReps : undefined,
            suggestedRightWeight: s.isUnilateral ? suggested.rightWeight : undefined,
            suggestedRightReps: s.isUnilateral ? suggested.rightReps : undefined,
          };
        });

        const nextArr = [...prev];
        nextArr[exIdx] = { ...targetEx, sets: setsWithCategory };
        return nextArr;
      }

      const nextArr = [...prev];
      nextArr[exIdx] = { ...targetEx, sets: nextSets };
      return nextArr;
    });
  }, [isProgressiveOverloadEnabled, sessions]);

  // Set completeness toggler
  const toggleSetComplete = useCallback((exIdx: number, setIdx: number) => {
    const targetSet = activeExercisesRef.current[exIdx]?.sets[setIdx];
    if (!targetSet) return;
    const willBeCompleted = !targetSet.completed;

    if (activeInputRef.current) {
      const { exIdx: curEx, setIdx: curSet, fieldName: curField } = activeInputRef.current;
      updateSetField(curEx, curSet, curField, tempInputValueRef.current);
    }

    if (willBeCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      playSetCheckedSound();
      playSatisfyingClickFinishSet();
      if (isAutoTimerEnabled) {
        const customRest = activeExercisesRef.current[exIdx]?.autoTimer;
        const duration = typeof customRest === 'number' ? customRest : defaultRestDuration;
        restTimerEmitter.start(duration);
      }
    } else {
      playUncheckSetSound();
    }

    safeLayoutAnim();
    setActiveExercises(prev => {
      if (!prev[exIdx]) return prev;
      const targetEx = prev[exIdx];
      if (!targetEx.sets[setIdx]) return prev;
      const targetSet = targetEx.sets[setIdx];

      let updatedSet = { ...targetSet, completed: willBeCompleted };
      if (activeInputRef.current && activeInputRef.current.exIdx === exIdx && activeInputRef.current.setIdx === setIdx) {
        const fName = activeInputRef.current.fieldName as keyof SetRecord;
        if (tempInputValueRef.current !== undefined) {
          (updatedSet as any)[fName] = tempInputValueRef.current;
        }
      }

      // Note: suggestedWeight/suggestedReps are visual placeholders only.
      // We intentionally do NOT auto-fill them into the set data on check,
      // so that history reflects what the user actually typed (or 0 if nothing).


      const nextSets = [...targetEx.sets];
      nextSets[setIdx] = updatedSet;
      const nextArr = [...prev];
      nextArr[exIdx] = { ...targetEx, sets: nextSets };
      return nextArr;
    });
  }, [isAutoTimerEnabled, defaultRestDuration, updateSetField]);

  // Stable keyboard close/dismiss handler
  const handleCloseKeyboard = useCallback(() => {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark('close-kb-start');
      }
    } catch (_) {}
    if (activeInputRef.current) {
      updateSetField(activeInputRef.current.exIdx, activeInputRef.current.setIdx, activeInputRef.current.fieldName, tempInputValueRef.current);
    }
    activeInputRef.current = null;
    activeInputStore.setActiveInput(null);
    setIsKeyboardVisible(false);
  }, [updateSetField]);

  // Stable input focus handler (must NOT be inside .map())
  const handleSetFocus = useCallback((ex: number, s: number, field: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps') => {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark('focus-start');
      }
    } catch (_) {}

    // Commit previous field value first (only if modified)
    if (activeInputRef.current) {
      const prevEx = activeInputRef.current.exIdx;
      const prevSet = activeInputRef.current.setIdx;
      const prevField = activeInputRef.current.fieldName;
      const currentStored = activeExercisesRef.current[prevEx]?.sets[prevSet]?.[prevField] ?? '';
      if (String(currentStored) !== tempInputValueRef.current) {
        updateSetField(prevEx, prevSet, prevField, tempInputValueRef.current);
      }
    }

    // Set the new input value and focus
    const currentVal = activeExercisesRef.current[ex]?.sets[s]?.[field] ?? '';
    const valStr = String(currentVal);
    tempInputValueRef.current = valStr;
    
    const newInput = { exIdx: ex, setIdx: s, fieldName: field, focusTime: Date.now() };
    activeInputRef.current = newInput;
    activeInputStore.setActiveInput(newInput);
    keyboardValueStore.setValue(valStr);
    setIsKeyboardVisible(prev => prev ? prev : true);
  }, [updateSetField]);

  useLayoutEffect(() => {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        if (isKeyboardVisible) {
          if (performance.getEntriesByName('focus-start').length > 0) {
            performance.mark('kb-open-end');
            const m = performance.measure('kb-open', 'focus-start', 'kb-open-end');
            if (m) console.log(`[BENCHMARK] Keyboard open took: ${m.duration.toFixed(2)}ms`);
            performance.clearMarks('focus-start');
            performance.clearMarks('kb-open-end');
          }
        } else {
          if (performance.getEntriesByName('close-kb-start').length > 0) {
            performance.mark('kb-close-end');
            const m = performance.measure('kb-close', 'close-kb-start', 'kb-close-end');
            if (m) console.log(`[BENCHMARK] Keyboard close took: ${m.duration.toFixed(2)}ms`);
            performance.clearMarks('close-kb-start');
            performance.clearMarks('kb-close-end');
          }
        }
      }
    } catch (_) {}
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (visible) {
      setLocalWorkoutName(workoutName);
    } else {
      if (activeInputRef.current) {
        updateSetField(activeInputRef.current.exIdx, activeInputRef.current.setIdx, activeInputRef.current.fieldName, tempInputValueRef.current);
      }
      activeInputRef.current = null;
      activeInputStore.setActiveInput(null);
      setIsKeyboardVisible(false);
      if (hasSyncedPropsRef.current) {
        flushExercisesToParent(activeExercisesRef.current);
      }
    }
  }, [visible, workoutName, updateSetField, flushExercisesToParent]);

  // Add a set
  const addSet = useCallback((exIdx: number, isUnilateral?: boolean) => {
    safeLayoutAnim();
    setActiveExercises(prev => {
      if (!prev[exIdx]) return prev;
      const targetEx = prev[exIdx];
      const currentSets = targetEx.sets;
      const lastSet = currentSets[currentSets.length - 1];
      const category = lastSet?.category ?? 'S';
      const positionInCategory = currentSets.filter(s => (s.category || 'S') === category).length;
      const unilateral = isUnilateral !== undefined ? isUnilateral : (lastSet ? !!lastSet.isUnilateral : false);

      const histSuggested = getPreviousSessionSetSuggestion(targetEx.name, category, positionInCategory, sessions, unilateral, undefined, undefined, sessionsByExerciseMap);
      let suggested: SetSuggestion = { weight: '', reps: '', leftWeight: '', leftReps: '', rightWeight: '', rightReps: '' };

      if (histSuggested.weight || histSuggested.reps || histSuggested.leftWeight) {
        suggested = histSuggested;
      } else if (lastSet) {
        const fallbackW = lastSet.weight || (lastSet as any).suggestedWeight || '';
        const fallbackR = lastSet.reps || (lastSet as any).suggestedReps || '';
        suggested = {
          weight: fallbackW,
          reps: fallbackR,
          leftWeight: lastSet.leftWeight || (lastSet as any).suggestedLeftWeight || fallbackW,
          leftReps: lastSet.leftReps || (lastSet as any).suggestedLeftReps || fallbackR,
          rightWeight: lastSet.rightWeight || (lastSet as any).suggestedRightWeight || fallbackW,
          rightReps: lastSet.rightReps || (lastSet as any).suggestedRightReps || fallbackR,
        };
      }

      const newSet: SetRecord = {
        id:        `set-${exIdx}-${Date.now()}-${Math.random()}`,
        weight:    '',
        reps:      '',
        completed: false,
        rpe:       '',
        category:  category,
        isUnilateral: unilateral,
        leftWeight:   unilateral ? '' : undefined,
        leftReps:     unilateral ? '' : undefined,
        rightWeight:  unilateral ? '' : undefined,
        rightReps:    unilateral ? '' : undefined,
        suggestedWeight: suggested.weight,
        suggestedReps: suggested.reps,
        suggestedLeftWeight: unilateral ? suggested.leftWeight : undefined,
        suggestedLeftReps: unilateral ? suggested.leftReps : undefined,
        suggestedRightWeight: unilateral ? suggested.rightWeight : undefined,
        suggestedRightReps: unilateral ? suggested.rightReps : undefined,
      } as any;

      const nextArr = [...prev];
      nextArr[exIdx] = {
        ...targetEx,
        sets: [...currentSets, newSet]
      };
      return nextArr;
    });
  }, [isProgressiveOverloadEnabled, sessions]);

  // Delete a set
  const deleteSet = useCallback((exIdx: number, setIdx: number) => {
    try {
      setActiveExercises(prev => {
        if (!prev[exIdx]) return prev;
        const targetEx = prev[exIdx];
        const nextSets = targetEx.sets.filter((_, sIdx) => sIdx !== setIdx);
        const nextArr = [...prev];
        nextArr[exIdx] = { ...targetEx, sets: nextSets };
        return nextArr;
      });
      // Shift or clear active input if it matches the deleted set/exercise
      const curr = activeInputRef.current;
      if (curr && curr.exIdx === exIdx) {
        if (curr.setIdx === setIdx) {
          activeInputRef.current = null;
          activeInputStore.setActiveInput(null);
          setIsKeyboardVisible(false);
        } else if (curr.setIdx > setIdx) {
          const nextVal = { ...curr, setIdx: curr.setIdx - 1 };
          activeInputRef.current = nextVal;
          activeInputStore.setActiveInput(nextVal);
        }
      }
    } catch (err: any) {
      const msg = `[ActiveWorkout] deleteSet(exIdx=${exIdx}, setIdx=${setIdx}) crashed: ${err?.message ?? err}`;
      saveCrashLogSync(msg, err?.stack ?? '', false);
      console.error(msg, err);
    }
  }, []);

  // Handle custom keyboard "Next" button click
  const handleNextField = useCallback(() => {
    const activeInputVal = activeInputRef.current;
    if (!activeInputVal) return;
    const { exIdx, setIdx, fieldName } = activeInputVal;

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
          restTimerEmitter.start(duration);
        }
        safeLayoutAnim();
        setActiveExercises(prev => {
          if (!prev[exIdx]) return prev;
          const targetEx = prev[exIdx];
          if (!targetEx.sets[setIdx]) return prev;
          const nextSets = [...targetEx.sets];
          
          let updatedSet = { ...nextSets[setIdx], completed: true };
          if (activeInputVal && activeInputVal.exIdx === exIdx && activeInputVal.setIdx === setIdx) {
            const fName = activeInputVal.fieldName as keyof SetRecord;
            if (tempInputValueRef.current !== undefined) {
              (updatedSet as any)[fName] = tempInputValueRef.current;
            }
          }
          if (!updatedSet.weight && (updatedSet as any).suggestedWeight) {
            updatedSet.weight = (updatedSet as any).suggestedWeight;
          }
          if (!updatedSet.reps && (updatedSet as any).suggestedReps) {
            updatedSet.reps = (updatedSet as any).suggestedReps;
          }
          if (updatedSet.isUnilateral) {
            if (!updatedSet.leftWeight && (updatedSet as any).suggestedLeftWeight) {
              updatedSet.leftWeight = (updatedSet as any).suggestedLeftWeight;
            }
            if (!updatedSet.leftReps && (updatedSet as any).suggestedLeftReps) {
              updatedSet.leftReps = (updatedSet as any).suggestedLeftReps;
            }
            if (!updatedSet.rightWeight && (updatedSet as any).suggestedRightWeight) {
              updatedSet.rightWeight = (updatedSet as any).suggestedRightWeight;
            }
            if (!updatedSet.rightReps && (updatedSet as any).suggestedRightReps) {
              updatedSet.rightReps = (updatedSet as any).suggestedRightReps;
            }
          }
          
          nextSets[setIdx] = updatedSet;
          const nextArr = [...prev];
          nextArr[exIdx] = { ...targetEx, sets: nextSets };
          return nextArr;
        });
      }
    }

    // 2. Keyboard Dismiss on Next: When pressing "Next" inside Reps box (bilateral) or rightReps (unilateral)
    if (fieldName === 'reps' || fieldName === 'rightReps') {
      handleCloseKeyboard();
      return;
    }

    // 3. Default Jumps for bilateral sets
    if (fieldName === 'weight') {
      const nextKey = `${exIdx}-${setIdx}-reps`;
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 4. Default Jumps for unilateral sets: leftWeight -> leftReps -> rightWeight -> rightReps
    if (fieldName === 'leftWeight') {
      const nextKey = `${exIdx}-${setIdx}-leftReps`;
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }
    if (fieldName === 'leftReps') {
      const nextKey = `${exIdx}-${setIdx}-rightWeight`;
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }
    if (fieldName === 'rightWeight') {
      const nextKey = `${exIdx}-${setIdx}-rightReps`;
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
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 6. Otherwise, close/blur
    handleCloseKeyboard();
  }, [activeExercises, isAutoFinishSetEnabled, isAutoTimerEnabled, defaultRestDuration, updateSetField, handleCloseKeyboard]);

  // Calculate volume & sets for summary
  const handleFinishPress = () => {
    cleanupTimerAndNotifications();
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
    flushExercisesToParent(activeExercises);
    onFinish({
      totalVolume,
      totalSets,
      durationMin,
      comment: workoutNote.trim(),
    });
  };

  const cleanupTimerAndNotifications = () => {
    restTimerEmitter.stop();
    cancelRestTimerNotification();
    stopWorkoutForeground();
    dismissWorkoutBackgroundNotification();
    setForegroundSuppression(false);
  };

  const handleDiscardPress = () => {
    let completedSetsCount = 0;
    activeExercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) completedSetsCount++;
      });
    });

    if (completedSetsCount === 0) {
      cleanupTimerAndNotifications();
      setActiveExercises([]);
      wasInitializedRef.current = false;
      onDiscard();
    } else {
      WebSafeAlert.alert(
        'Discard Workout?',
        'Are you sure you want to discard this workout? All tracked sets will be permanently lost.',
        [
          { text: 'Keep Tracking', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              cleanupTimerAndNotifications();
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
  const handleExerciseMenuPress = useCallback((exIdx: number) => {
    setActiveExerciseMenuIndex(exIdx);
    setIsExMenuVisible(true);
  }, []);

  const handleOpenExerciseInsights = useCallback((exIdx: number) => {
    setActiveExerciseMenuIndex(exIdx);
    setIsExerciseInsightsVisible(true);
  }, []);

  const handleRemoveExercise = () => {
    if (activeExerciseMenuIndex !== null) {
      WebSafeAlert.alert(
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
              const curr = activeInputRef.current;
              if (curr) {
                if (curr.exIdx === targetIdx) {
                  activeInputRef.current = null;
                  activeInputStore.setActiveInput(null);
                  setIsKeyboardVisible(false);
                } else if (curr.exIdx > targetIdx) {
                  const nextVal = { ...curr, exIdx: curr.exIdx - 1 };
                  activeInputRef.current = nextVal;
                  activeInputStore.setActiveInput(nextVal);
                }
              }
              setActiveExerciseMenuIndex(null);
            }
          }
        ]
      );
    }
  };

  const handleSelectVariation = useCallback((exIdx: number, newVariation: string | undefined) => {
    setActiveExercises((prev: ActiveExercise[]) => {
      if (!prev[exIdx] || !prev[exIdx].name || typeof prev[exIdx].name !== 'string') return prev;
      const targetEx = prev[exIdx];
      const libEx = exerciseLibraryMap.get(targetEx.name.toLowerCase());
      const isUnilateral = libEx?.isUnilateral || false;

      const updatedSets = targetEx.sets.map((s, sIdx) => {
        const category = s.category || 'S';
        let positionInCategory = 0;
        for (let i = 0; i < sIdx; i++) {
          if ((targetEx.sets[i].category || 'S') === category) {
            positionInCategory++;
          }
        }

        const defaultW = (libEx?.bestWeight ?? 0).toString();
        const defaultR = (libEx?.bestReps ?? 0).toString();
        let suggested: SetSuggestion = {
          weight: defaultW,
          reps: defaultR,
          leftWeight: defaultW,
          leftReps: defaultR,
          rightWeight: defaultW,
          rightReps: defaultR,
        };

        if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
          try {
            const perfSuggested = getBestPerformanceSuggestionForSet(
              targetEx.name,
              category,
              positionInCategory,
              sessions,
              isUnilateral,
              newVariation,
              libEx
            );
            if (perfSuggested.weight || perfSuggested.reps) {
              suggested = perfSuggested;
            }
          } catch (err) {
            console.warn('[ActiveWorkout] Error getting performance suggestion for variation:', err);
          }
        }

        return {
          ...s,
          suggestedWeight: suggested.weight,
          suggestedReps: suggested.reps,
          suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
          suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
          suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
          suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
        };
      });

      const nextArr = [...prev];
      nextArr[exIdx] = {
        ...targetEx,
        variation: newVariation,
        sets: updatedSets,
      };
      return nextArr;
    });
  }, [exerciseLibraryMap, isProgressiveOverloadEnabled, sessions]);

  const handleDeleteExercise = useCallback((exIdx: number) => {
    setActiveExercises(prev => {
      const filtered = prev.filter((_, idx) => idx !== exIdx);
      return sanitizeSuperSets(filtered);
    });
    // Shift or clear active input if it matches the deleted exercise
    const curr = activeInputRef.current;
    if (curr) {
      if (curr.exIdx === exIdx) {
        activeInputRef.current = null;
        activeInputStore.setActiveInput(null);
        setIsKeyboardVisible(false);
      } else if (curr.exIdx > exIdx) {
        const nextVal = { ...curr, exIdx: curr.exIdx - 1 };
        activeInputRef.current = nextVal;
        activeInputStore.setActiveInput(nextVal);
      }
    }
  }, []);

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
        const category = s.category || 'S';
        let positionInCategory = 0;
        for (let i = 0; i < sIdx; i++) {
          if ((targetEx.sets[i].category || 'S') === category) {
            positionInCategory++;
          }
        }
        const libEx = exerciseLibraryMap.get(exName.toLowerCase());
        const defaultW = (libEx?.bestWeight ?? 0).toString();
        const defaultR = (libEx?.bestReps ?? 0).toString();
        let suggested: SetSuggestion = {
          weight: defaultW,
          reps: defaultR,
          leftWeight: defaultW,
          leftReps: defaultR,
          rightWeight: defaultW,
          rightReps: defaultR,
        };
        if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
          const perfSuggested = getBestPerformanceSuggestionForSet(exName, category, positionInCategory, sessions, isUnilateral);
          if (perfSuggested.weight || perfSuggested.reps) {
            suggested = perfSuggested;
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
        const libEx = exerciseLibraryMap.get(exName.toLowerCase());
        const isUnilateral = libEx?.isUnilateral || false;
        
        let setsCount = 3;
        if (sessions && sessions.length > 0) {
          const previousSession = sessions.find((s: any) =>
            s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase())
          );
          const found = previousSession?.exercises.find((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase());
          if (found) {
            setsCount = found.setsDetails?.length || found.sets || 3;
          }
        }

        const sets = Array.from({ length: setsCount }).map((_, sIdx) => {
          const category = 'S';
          const positionInCategory = sIdx;
          const defaultW = (libEx?.bestWeight ?? 0).toString();
          const defaultR = (libEx?.bestReps ?? 0).toString();
          let suggested: SetSuggestion = {
            weight: defaultW,
            reps: defaultR,
            leftWeight: defaultW,
            leftReps: defaultR,
            rightWeight: defaultW,
            rightReps: defaultR,
          };
          if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
            const perfSuggested = getBestPerformanceSuggestionForSet(exName, category, positionInCategory, sessions, isUnilateral);
            if (perfSuggested.weight || perfSuggested.reps) {
              suggested = perfSuggested;
            }
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
      safeLayoutAnim();
      setActiveExercises(prev => [...prev, ...newOnes]);
    }
    setIsLibraryVisible(false);
  }, [isReplaceMode, activeExerciseMenuIndex, isProgressiveOverloadEnabled, sessions, exerciseLibrary, activeExercises]);

  // Legacy single-select compat (used internally)
  const handleSelectLibraryExercise = (exName: string) => {
    handleConfirmExercisesFromPicker([exName]);
  };

  // Legacy exercise drag helpers removed

  const handleSaveCustomExercise = () => {
    if (!customExerciseName.trim()) {
      WebSafeAlert.alert('Error', 'Please enter an exercise name.');
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
        safeLayoutAnim();
        setActiveExercises(prev => [...prev, newActive]);
        setIsLibraryVisible(false);
        setIsCreatingCustom(false);
      }
    } else {
      WebSafeAlert.alert('Info', 'Database integration is missing in this view.');
    }
  };

  // Search filtered library exercises
  const filteredLibrary = useMemo(() => {
    if (!librarySearch.trim()) return exerciseLibrary;
    return exerciseLibrary.filter(ex => ex.name.toLowerCase().includes(librarySearch.toLowerCase().trim()));
  }, [exerciseLibrary, librarySearch]);

  const scrollContentStyle = useMemo(() => [
    styles.scrollContent,
    isTimerSubMenuVisible ? { paddingBottom: spacing.xxxl * 3 } : { paddingBottom: spacing.xxl },
    isKeyboardVisible ? { paddingBottom: 280 } : null
  ], [isTimerSubMenuVisible, isKeyboardVisible]);

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
                  testID="minimize-workout-btn"
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
                
                <RestTimerHeaderButton
                  isSubMenuVisible={isTimerSubMenuVisible}
                  onToggleSubMenu={() => setIsTimerSubMenuVisible(!isTimerSubMenuVisible)}
                  defaultRestDuration={defaultRestDuration}
                />
                 {/* Plate Calculator button was removed from here */}
              </View>

              <View pointerEvents="box-none" style={styles.headerCenter}>
                <ElapsedTimeText
                  startTime={resumeStartTime.current}
                  offsetSeconds={accumulatedOffsetSeconds.current}
                  visible={visible}
                  style={styles.headerTimerText}
                />
              </View>

              <View style={styles.headerRight}>
                <Pressable
                  testID="add-exercise-btn"
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
                  testID="finish-workout-btn"
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
            <Animated.ScrollView
              ref={scrollRef}
              scrollEnabled={scrollEnabled}
              style={styles.scroll}
              contentContainerStyle={scrollContentStyle}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
              onStartShouldSetResponder={() => {
                if (activeInputRef.current !== null) {
                  handleCloseKeyboard();
                }
                return false;
              }}
            >
              {/* Workout Title Section */}
              <View style={styles.workoutTitleSection}>
                <TextInput
                  testID="workout-title-input"
                  // React Native Web normally maps testID to data-testid. Keep the
                  // DOM attribute explicit for the restored modal too, where the
                  // persistence runner reads the title immediately after reload.
                  {...(Platform.OS === 'web' ? { 'data-testid': 'workout-title-input' } : {})}
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

              {/* Inline Workout Note Input */}
              <View style={styles.workoutNoteInlineContainer}>
                <Ionicons name="document-text-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.workoutNoteInlineInput}
                  placeholder="Add workout note..."
                  placeholderTextColor={colors.textMuted}
                  value={workoutNote}
                  onChangeText={(val) => {
                    setWorkoutNote(val);
                    if (onUpdateComment) {
                      onUpdateComment(val.trim());
                    }
                  }}
                  multiline
                  keyboardAppearance="dark"
                  maxLength={250}
                  testID="workout-note-input"
                />
              </View>

              {activeExercises.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No exercises added yet.</Text>
                </View>
              ) : (
              <View
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0 && w !== listWidth) {
                    setListWidth(w);
                  }
                }}
                style={{ width: '100%' }}
              >
              <Sortable.Flex
                flexDirection="column"
                gap={0}
                width="fill"
                customHandle
                dragActivationDelay={0}
                dragActivationFailOffset={10}
                activeItemScale={1.03}
                activeItemOpacity={0.92}
                activeItemShadowOpacity={0.5}
                inactiveItemOpacity={1}
                inactiveItemScale={1}
                enableActiveItemSnap={true}
                dimensionsAnimationType="worklet"
                itemsLayoutTransitionMode="reorder"
                dropAnimationDuration={120}
                strategy="insert"
                reorderTriggerOrigin="center"
                overDrag="vertical"
                hapticsEnabled
                scrollableRef={scrollRef}
                onDragStart={() => setScrollEnabled(false)}
                onDragEnd={({ order }) => {
                  setScrollEnabled(true);
                  setTimeout(() => {
                    setActiveExercises(prev => sanitizeSuperSets(order(prev) as ActiveExercise[]));
                  }, 120);
                }}
                onActiveItemDropped={() => setScrollEnabled(true)}
                itemExiting={null}
              >
                {activeExercises.slice(0, renderedCardLimit).map((exercise, exIdx) => {
                  const isSuperSet = !!exercise.superSetGroupId;
                  const nextIsSameSuperSet = isSuperSet && exIdx < activeExercises.length - 1 && activeExercises[exIdx + 1].superSetGroupId === exercise.superSetGroupId;
                  const prevIsSameSuperSet = isSuperSet && exIdx > 0 && activeExercises[exIdx - 1].superSetGroupId === exercise.superSetGroupId;
                  const superSetColor = exercise.superSetGroupId ? (superSetColors[exercise.superSetGroupId] || colors.accent) : undefined;

                  return (
                    <ActiveExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      exIdx={exIdx}
                      listWidth={listWidth}
                      nextIsSameSuperSet={nextIsSameSuperSet}
                      prevIsSameSuperSet={prevIsSameSuperSet}
                      isSuperSet={isSuperSet}
                      superSetColor={superSetColor}
                      handleDeleteExercise={handleDeleteExercise}
                      handleExerciseMenuPress={handleExerciseMenuPress}
                      handleOpenExerciseInsights={handleOpenExerciseInsights}
                      handleSelectVariation={handleSelectVariation}
                      exerciseLibraryMap={exerciseLibraryMap}
                      handleSetFocus={handleSetFocus}
                      updateSetField={updateSetField}
                      deleteSet={deleteSet}
                      toggleSetComplete={toggleSetComplete}
                      inputRefs={inputRefs}
                      isRpeMode={isRpeMode}
                      addSet={addSet}
                    />
                  );
                })}
              </Sortable.Flex>
              </View>
              )}

              {/* Discard Workout button */}
              <Pressable
                testID="discard-workout-btn"
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
            </Animated.ScrollView>

            {/* Timer Ruler Sub-menu */}
            {isTimerSubMenuVisible && (
              <View style={styles.timerSubMenu}>
                <RestTimerRulerContainer
                  defaultRestDuration={defaultRestDuration}
                  onCloseSubMenu={() => setIsTimerSubMenuVisible(false)}
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
                  testID="ex-menu-backdrop"
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...exMenuPanResponder.panHandlers}
                    {...({ onClick: (e: any) => e.stopPropagation() } as any)}
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
                        setAutoTimerDraft(currentTimer ?? defaultRestDuration);
                        setIsExMenuVisible(false);
                        setIsTimerPickerVisible(true);
                      }}
                      android_ripple={rippleTokens.surface}
                      testID="set-auto-timer"
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
                          const libEx = exerciseLibraryMap.get(exName.toLowerCase());
                          setNoteText(libEx?.notes || '');
                          setIsExMenuVisible(false);
                          setIsNotesModalVisible(true);
                        }
                      }}
                      android_ripple={rippleTokens.surface}
                      testID="view-edit-notes"
                    >
                      <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                      <Text style={styles.sheetItemText}>View/Edit Notes</Text>
                    </Pressable>

                    <Pressable
                      style={styles.sheetItem}
                      onPress={() => {
                        if (activeExerciseMenuIndex !== null) {
                          setIsExMenuVisible(false);
                          setIsExerciseInsightsVisible(true);
                        }
                      }}
                      android_ripple={rippleTokens.surface}
                      testID="exercise-insights-menu-item"
                    >
                      <Ionicons name="analytics-outline" size={20} color={colors.accent} />
                      <Text style={styles.sheetItemText}>Exercise Insights</Text>
                    </Pressable>

                    <Pressable
                      style={styles.sheetItem}
                      onPress={handleOpenReplace}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="swap-horizontal-outline" size={20} color={colors.accent} />
                      <Text style={styles.sheetItemText}>Replace Exercise</Text>
                    </Pressable>

                    {/* Switch to Unilateral / Bilateral mode toggle option */}
                    <Pressable
                      style={styles.sheetItem}
                      onPress={() => {
                        if (activeExerciseMenuIndex !== null) {
                          const currentEx = activeExercises[activeExerciseMenuIndex];
                          if (!currentEx) return;
                          const isCurrentlyUnilateral = currentEx.sets?.some((s: any) => s.isUnilateral) || false;
                          const targetUnilateral = !isCurrentlyUnilateral;

                          // 1. Update local active exercises state sets configuration
                          setActiveExercises(prev => prev.map((ex, idx) => {
                            if (idx !== activeExerciseMenuIndex) return ex;
                            return {
                              ...ex,
                              sets: ex.sets.map(s => {
                                const unilateral = targetUnilateral;
                                return {
                                  ...s,
                                  isUnilateral: unilateral,
                                  leftWeight: unilateral ? (s.leftWeight !== undefined ? s.leftWeight : s.weight) : undefined,
                                  leftReps: unilateral ? (s.leftReps !== undefined ? s.leftReps : s.reps) : undefined,
                                  rightWeight: unilateral ? (s.rightWeight !== undefined ? s.rightWeight : s.weight) : undefined,
                                  rightReps: unilateral ? (s.rightReps !== undefined ? s.rightReps : s.reps) : undefined,
                                };
                              })
                            };
                          }));

                          // 2. Update global exercises list mode state
                          const libEx = currentEx?.name ? exerciseLibraryMap.get(currentEx.name.toLowerCase()) : undefined;
                          if (libEx && onUpdateExercise) {
                            onUpdateExercise(
                              libEx.id,
                              libEx.name,
                              libEx.muscleGroup,
                              libEx.equipment || 'Other',
                              targetUnilateral
                            );
                          }
                          
                          setIsExMenuVisible(false);
                        }
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="repeat-outline" size={20} color={colors.accent} />
                      <Text style={styles.sheetItemText}>
                        {activeExerciseMenuIndex !== null && activeExercises[activeExerciseMenuIndex]?.sets?.some((s: any) => s.isUnilateral)
                          ? i18n.t('extras.switchToBilateral')
                          : i18n.t('extras.switchToUnilateral')}
                      </Text>
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
                  testID="timer-picker-backdrop"
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...timerPickerPanResponder.panHandlers}
                    {...({ onClick: (e: any) => e.stopPropagation() } as any)}
                  >
                    <View style={styles.dragHandleContainer}>
                      <View style={styles.sheetDragHandle} />
                    </View>

                    <Text style={styles.sheetTitle}>
                      {activeExercises[activeExerciseMenuIndex].name.toUpperCase()}
                    </Text>

                    {/* Rest Timer Picker wrapper */}
                    <View style={{ marginVertical: spacing.md }}>
                      <RestTimerPicker
                        value={autoTimerDraft}
                        defaultValue={defaultRestDuration}
                        max={1000}
                        step={5}
                        onChange={setAutoTimerDraft}
                        onCommit={setAutoTimerDraft}
                        onReset={() => setAutoTimerDraft(defaultRestDuration)}
                        onSave={() => {
                          if (autoTimerDraft <= 0 || autoTimerDraft > 1000) {
                            WebSafeAlert.alert('Invalid Input', 'Please select a valid rest duration.');
                            return;
                          }
                          setActiveExercises(prev => {
                            const updated = [...prev];
                            updated[activeExerciseMenuIndex] = {
                              ...updated[activeExerciseMenuIndex],
                              autoTimer: autoTimerDraft === defaultRestDuration ? undefined : autoTimerDraft,
                            };
                            return updated;
                          });
                          setIsTimerPickerVisible(false);
                        }}
                      />
                    </View>
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
                        testID="notes-input"
                      />

                      <View style={{ flexDirection: 'row', columnGap: spacing.md, marginTop: spacing.md, width: '100%' }}>
                        <Pressable
                          style={[styles.modalBtnCancel, { flex: 1 }]}
                          onPress={() => setIsNotesModalVisible(false)}
                          testID="cancel-notes-btn"
                        >
                          <Text style={styles.modalBtnCancelText}>CANCEL</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modalBtnSave, { flex: 1 }]}
                          onPress={() => {
                            const trimmed = noteText.trim() || undefined;
                            const idx = activeExerciseMenuIndex;
                            if (activeExercises[idx]) {
                              const exName = activeExercises[idx].name;
                              setActiveExercises(prev => {
                                const next = [...prev];
                                if (next[idx]) {
                                  next[idx] = { ...next[idx], note: trimmed };
                                }
                                return next;
                              });
                              const libEx = exerciseLibraryMap.get(exName.toLowerCase());
                              if (libEx && onUpdateExerciseNotes) {
                                onUpdateExerciseNotes(libEx.id, trimmed);
                              }
                            }
                            setIsNotesModalVisible(false);
                          }}
                          testID="save-notes-btn"
                        >
                          <Text style={styles.modalBtnSaveText}>SAVE</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Modal: Exercise Insights */}
            {isExerciseInsightsVisible && activeExerciseMenuIndex !== null && activeExercises[activeExerciseMenuIndex]?.name && (
              <ExerciseInsightsModal
                visible={isExerciseInsightsVisible}
                exerciseName={activeExercises[activeExerciseMenuIndex].name}
                exerciseLibraryEntry={exerciseLibraryMap.get(activeExercises[activeExerciseMenuIndex].name.toLowerCase())}
                sessions={sessions}
                onClose={() => setIsExerciseInsightsVisible(false)}
                onUpdateExerciseInsightsNotes={onUpdateExerciseInsightsNotes}
                onUpdateExerciseVariations={onUpdateExerciseVariations}
              />
            )}

            {/* Modal C: Barbell Plate Calculator was removed from here */}

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
                  testID="workout-menu-backdrop"
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...workoutMenuPanResponder.panHandlers}
                    {...({ onClick: (e: any) => e.stopPropagation() } as any)}
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
                                WebSafeAlert.alert('Error', 'Invalid hours (must be 00-23)');
                              }
                            } else {
                              WebSafeAlert.alert('Error', 'Invalid format. Use HH:MM');
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
                  testID="default-timer-backdrop"
                >
                  <RN.Animated.View
                    style={[
                      styles.sheetCard,
                      { transform: [{ translateY: sheetTranslateY }] }
                    ]}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    {...defaultTimerPanResponder.panHandlers}
                    {...({ onClick: (e: any) => e.stopPropagation() } as any)}
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

            <ActiveWorkoutKeyboardWrapper
              activeExercises={activeExercises}
              updateSetField={updateSetField}
              isRpeMode={isRpeMode}
              handleNextField={handleNextField}
              handleCloseKeyboard={handleCloseKeyboard}
              tempInputValueRef={tempInputValueRef}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
    {isLibraryVisible && (
      <AddExerciseScreen
        visible={isLibraryVisible}
        exercises={exerciseLibrary}
        onConfirm={handleConfirmExercisesFromPicker}
        onClose={() => setIsLibraryVisible(false)}
        onAddCustomExercise={onAddCustomExercise}
        singleSelect={isReplaceMode}
        title={isReplaceMode ? 'REPLACE EXERCISE' : 'ADD EXERCISES'}
      />
    )}
    </>
  );
};











export default React.memo(ActiveWorkoutModal);
