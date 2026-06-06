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
  Animated,
  Easing,
  FlatList,
  PanResponder,
  Vibration,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../../theme';
import { ExerciseSet } from '../../data/mockData';
import IconButton from '../ui/IconButton';
import { CustomWorkoutKeyboard } from '../ui/CustomWorkoutKeyboard';
import { playSetCheckedSound, playTimerCompletedSound, playWorkoutCompletedSound } from '../../utils/soundPlayer';
import AddExerciseScreen from '../../screens/AddExerciseScreen';

interface SetRecord {
  id:        string;
  weight:    string;
  reps:      string;
  completed: boolean;
  rpe?:      string;
  category?: 'W' | 'S' | 'D' | 'F';
}

interface ActiveExercise {
  id: string;
  name: string;
  sets: SetRecord[];
  superSetGroupId?: string;
}

interface ActiveWorkoutModalProps {
  visible:            boolean;
  workoutName:        string;
  startTime:          Date;
  exercises:          ExerciseSet[];
  isAutoTimerEnabled: boolean;
  onClose:            () => void;
  onFinish:           (summary: { totalVolume: number; totalSets: number; durationMin: number }) => void;
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
}

function formatElapsed(startTime: Date): string {
  const totalSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const h   = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${min}:${sec}` : `${min}:${sec}`;
}

const SwipeableRow: React.FC<{
  children: React.ReactNode;
  onDelete: () => void;
  borderRadius?: number;
  style?: any;
}> = ({ children, onDelete, borderRadius = radius.xs, style }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const animateTranslation = (toVal: number, callback?: () => void) => {
    if (globalAnimation.speed === 0) {
      Animated.timing(translateX, {
        toValue: toVal,
        duration: 0,
        useNativeDriver: true,
      }).start(callback);
    } else {
      Animated.spring(translateX, {
        toValue: toVal,
        useNativeDriver: true,
        stiffness: 140 / (globalAnimation.speed * globalAnimation.speed),
        damping: 16 / globalAnimation.speed,
        mass: 0.9,
      }).start(callback);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 8;
      },
      onPanResponderMove: (_, gestureState) => {
        let newX = gestureState.dx;
        if (isOpen.current) {
          newX = -70 + gestureState.dx;
        }
        if (newX > 0) newX = 0;
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = isOpen.current ? -30 : -45;
        if (gestureState.dx < threshold) {
          animateTranslation(-70, () => {
            isOpen.current = true;
          });
        } else {
          animateTranslation(0, () => {
            isOpen.current = false;
          });
        }
      },
    })
  ).current;

  const handleDeletePress = () => {
    if (Platform.OS !== 'web') Vibration.vibrate(15);
    Animated.timing(translateX, {
      toValue: -500,
      duration: getScaledDuration(150),
      useNativeDriver: true,
    }).start(() => {
      onDelete();
      translateX.setValue(0);
      isOpen.current = false;
    });
  };

  const handleOverlayPress = () => {
    if (isOpen.current) {
      animateTranslation(0, () => {
        isOpen.current = false;
      });
    }
  };

  const underlayOpacity = translateX.interpolate({
    inputRange: [-10, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.swipeContainer, { borderRadius }, style]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: underlayOpacity }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDeletePress}
        >
          <View style={[styles.swipeDeleteAction, { borderRadius }]}>
            <Ionicons name="trash-outline" size={20} color="#FFF" />
          </View>
        </Pressable>
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
        onTouchStart={handleOverlayPress}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const getProgressiveOverloadSuggestions = (exName: string, sessions: any[]) => {
  const previousSession = sessions?.find((s: any) =>
    s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase())
  );
  if (previousSession) {
    const found = previousSession.exercises.find((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase());
    if (found) {
      const lastWeight = found.bestWeight || 0;
      const lastReps = found.bestReps || 0;
      const lastSets = typeof found.sets === 'number' ? found.sets : (found.setsDetails?.length || found.sets?.length || 3);
      if (lastWeight > 0) {
        return {
          weight: (lastWeight + 2.5).toString(),
          reps: lastReps.toString(),
          sets: lastSets,
        };
      } else {
        return {
          weight: '0',
          reps: (lastReps + 1).toString(),
          sets: lastSets,
        };
      }
    }
  }
  return null;
};

const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  visible,
  workoutName,
  startTime,
  exercises,
  isAutoTimerEnabled,
  onClose,
  onFinish,
  onDiscard,
  exerciseLibrary = [],
  onUpdateActiveExercises,
  onUpdateExerciseNotes,
  onAddCustomExercise,
  isLiveHeartRateEnabled = false,
  isPlateCalculatorEnabled = true,
  defaultRestDuration = 90,
  onRenameWorkout,
  sessions = [],
  isProgressiveOverloadEnabled = false,
  isAutoFinishSetEnabled = true,
  isKeyboardDismissOnNextEnabled = true,
}) => {
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime));
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [heartRate, setHeartRate] = useState(132);

  const [localWorkoutName, setLocalWorkoutName] = useState(workoutName);
  const [activeInput, setActiveInput] = useState<{
    exIdx: number;
    setIdx: number;
    fieldName: 'weight' | 'reps';
    focusTime?: number;
  } | null>(null);

  const inputRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    if (visible) {
      setLocalWorkoutName(workoutName);
    }
  }, [visible, workoutName]);

  // Live heart rate telemetry tick simulation
  useEffect(() => {
    if (!visible || !isLiveHeartRateEnabled) return;
    const id = setInterval(() => {
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

  // Exercise library selector modal states
  const [isLibraryVisible, setIsLibraryVisible] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeExerciseMenuIndex, setActiveExerciseMenuIndex] = useState<number | null>(null);
  const [isExMenuVisible, setIsExMenuVisible] = useState(false);
  const [isReplaceMode, setIsReplaceMode] = useState(false);

  // Custom exercise creation inside library picker
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('Chest');
  const [customEquipment, setCustomEquipment] = useState('Barbell');

  // Drag-and-drop reorder state for exercises
  const exDragY       = useRef(new Animated.Value(0)).current;
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

  // Sync props to state when modal becomes visible or when a new workout session actually starts
  useEffect(() => {
    if (visible && exercises.length > 0) {
      const startKey = startTime.toISOString();
      const isNewWorkout = lastStartTimeRef.current !== startKey;

      if (isNewWorkout || activeExercises.length === 0) {
        lastStartTimeRef.current = startKey;
        const initial = exercises.map((ex: any, exIdx) => {
          const setsCount = typeof ex.sets === 'number' ? ex.sets : (Array.isArray(ex.sets) ? ex.sets.length : 3);
          
          // Reconstruct SetRecord from setsDetails if present
          const existingDetails = (ex as any).setsDetails;
          const isSetsArray = Array.isArray(ex.sets);
          if (existingDetails && existingDetails.length > 0) {
            return {
              id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
              name: ex.name,
              sets: existingDetails.map((s: any, sIdx: number) => ({
                id:        `set-${exIdx}-${sIdx}-${Date.now()}`,
                weight:    s.weight.toString(),
                reps:      s.reps.toString(),
                completed: s.completed || false,
                rpe:       s.rpe ? s.rpe.toString() : '',
                category:  s.category || 'S',
              })),
              superSetGroupId: (ex as any).superSetGroupId,
            };
          } else if (isSetsArray && ex.sets.length > 0) {
            return {
              id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
              name: ex.name,
              sets: ex.sets.map((s: any, sIdx: number) => {
                let weightVal = s.weight ? s.weight.toString() : '60';
                let repsVal = s.reps ? s.reps.toString() : '10';
                if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
                  const suggestion = getProgressiveOverloadSuggestions(ex.name, sessions);
                  if (suggestion) {
                    weightVal = suggestion.weight;
                    repsVal = suggestion.reps;
                  }
                }
                return {
                  id:        s.id || `set-${exIdx}-${sIdx}-${Date.now()}`,
                  weight:    weightVal,
                  reps:      repsVal,
                  completed: s.completed || false,
                  rpe:       s.rpe ? s.rpe.toString() : '',
                  category:  s.category || 'S',
                };
              }),
              superSetGroupId: (ex as any).superSetGroupId,
            };
          }

          return {
            id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
            name: ex.name,
            sets: Array.from({ length: setsCount }).map((_, setIdx) => {
              let weightVal = ex.bestWeight ? ex.bestWeight.toString() : '60';
              let repsVal = ex.bestReps ? ex.bestReps.toString() : '10';
              if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
                const suggestion = getProgressiveOverloadSuggestions(ex.name, sessions);
                if (suggestion) {
                  weightVal = suggestion.weight;
                  repsVal = suggestion.reps;
                }
              }
              return {
                id:        `set-${exIdx}-${setIdx}-${Date.now()}`,
                weight:    weightVal,
                reps:      repsVal,
                completed: false,
                rpe:       '',
                category:  'S',
              };
            }),
            superSetGroupId: (ex as any).superSetGroupId,
          };
        });
        setActiveExercises(initial);
        setWorkoutFinished(false);
        setIsTimerActive(false);
      }
    }
  }, [visible, startTime]);

  // Sync active exercises back to parent App state so they are stored
  useEffect(() => {
    if (onUpdateActiveExercises) {
      const mapped = activeExercises.map(ex => {
        const completedSets = ex.sets.filter(s => s.completed);
        return {
          name: ex.name,
          sets: completedSets.length,
          bestWeight: completedSets.length > 0 ? Math.max(...completedSets.map(s => parseFloat(s.weight) || 0), 0) : 0,
          bestReps: completedSets.length > 0 ? Math.max(...completedSets.map(s => parseInt(s.reps, 10) || 0), 0) : 0,
          superSetGroupId: ex.superSetGroupId,
          setsDetails: ex.sets.map(s => ({
            weight: parseFloat(s.weight) || 0,
            reps: parseInt(s.reps, 10) || 0,
            completed: s.completed,
            rpe: s.rpe ? parseFloat(s.rpe) : undefined,
            category: s.category || 'S',
          })),
        };
      });
      onUpdateActiveExercises(mapped);
    }
  }, [activeExercises]);

  // Live timer interval
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setElapsed(formatElapsed(startTime)), 1000);
    return () => clearInterval(id);
  }, [visible, startTime]);

  // Rest Timer Countdown Interval
  useEffect(() => {
    if (!isTimerActive || restTimeRemaining <= 0) {
      if (isTimerActive && restTimeRemaining === 0) {
        setIsTimerActive(false);
      }
      return;
    }
    const timerId = setInterval(() => {
      setRestTimeRemaining(prev => {
        if (prev <= 1) {
          setIsTimerActive(false);
          playTimerCompletedSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [isTimerActive, restTimeRemaining]);

  const timerPulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isTimerActive) return;
    if (globalAnimation.speed === 0) {
      timerPulseAnim.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(timerPulseAnim, {
          toValue:         0.4,
          duration:        getScaledDuration(500),
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
        Animated.timing(timerPulseAnim, {
          toValue:         1,
          duration:        getScaledDuration(500),
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isTimerActive, timerPulseAnim, globalAnimation.speed]);

  // Set completeness toggler
  const toggleSetComplete = useCallback((exIdx: number, setIdx: number) => {
    const targetSet = activeExercises[exIdx]?.sets[setIdx];
    if (!targetSet) return;
    const willBeCompleted = !targetSet.completed;

    if (willBeCompleted) {
      playSetCheckedSound();
      if (isAutoTimerEnabled) {
        setRestTimeRemaining(defaultRestDuration);
        setIsTimerActive(true);
      }
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set, sIdx) => {
            if (sIdx !== setIdx) return set;
            return { ...set, completed: willBeCompleted };
          })
        };
      });
    });
  }, [activeExercises, isAutoTimerEnabled, defaultRestDuration]);

  // Set weight/reps/rpe/category updater
  const updateSetField = useCallback((exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'rpe' | 'category', value: string) => {
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set, sIdx) => {
            if (sIdx !== setIdx) return set;
            return { ...set, [field]: value };
          })
        };
      });
    });
  }, []);

  // Stable input focus handler (must NOT be inside .map())
  const handleSetFocus = useCallback((ex: number, s: number, field: 'weight' | 'reps') => {
    setActiveInput({ exIdx: ex, setIdx: s, fieldName: field, focusTime: Date.now() });
  }, []);

  // Add a set
  const addSet = useCallback((exIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        const currentSets = ex.sets;
        const lastSet = currentSets[currentSets.length - 1];
        const newSet: SetRecord = {
          id:        `set-${exIdx}-${Date.now()}-${Math.random()}`,
          weight:    lastSet?.weight ?? '60',
          reps:      lastSet?.reps ?? '10',
          completed: false,
          rpe:       '',
          category:  lastSet?.category ?? 'S',
        };
        return {
          ...ex,
          sets: [...currentSets, newSet]
        };
      });
    });
  }, []);

  // Delete a set
  const deleteSet = useCallback((exIdx: number, setIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveExercises(prev => {
      return prev.map((ex, eIdx) => {
        if (eIdx !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.filter((_, sIdx) => sIdx !== setIdx)
        };
      });
    });
  }, []);

  // Handle custom keyboard "Next" button click
  const handleNextField = useCallback(() => {
    if (!activeInput) return;
    const { exIdx, setIdx, fieldName } = activeInput;

    // 1. Auto-Finish Set: When pressing "Next" inside Reps box
    if (fieldName === 'reps' && isAutoFinishSetEnabled) {
      const targetSet = activeExercises[exIdx]?.sets[setIdx];
      if (targetSet && !targetSet.completed) {
        playSetCheckedSound();
        if (isAutoTimerEnabled) {
          setRestTimeRemaining(defaultRestDuration);
          setIsTimerActive(true);
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

    // 2. Keyboard Dismiss on Next: When pressing "Next" inside Reps box
    if (fieldName === 'reps' && isKeyboardDismissOnNextEnabled) {
      setActiveInput(null);
      return;
    }

    // 3. Default Jumps: If currently weight, move to reps in the same set
    if (fieldName === 'weight') {
      const nextKey = `${exIdx}-${setIdx}-reps`;
      setActiveInput({ exIdx, setIdx, fieldName: 'reps', focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 4. Default Jumps: If reps, check if there's a next set in the same exercise
    const currentEx = activeExercises[exIdx];
    if (currentEx && setIdx < currentEx.sets.length - 1) {
      const nextKey = `${exIdx}-${setIdx + 1}-weight`;
      setActiveInput({ exIdx, setIdx: setIdx + 1, fieldName: 'weight', focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 5. Default Jumps: If last set of this exercise, check if there is a next exercise
    if (exIdx < activeExercises.length - 1) {
      const nextKey = `${exIdx + 1}-0-weight`;
      setActiveInput({ exIdx: exIdx + 1, setIdx: 0, fieldName: 'weight', focusTime: Date.now() });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    // 6. Otherwise, close/blur
    setActiveInput(null);
  }, [activeInput, activeExercises, isAutoFinishSetEnabled, isKeyboardDismissOnNextEnabled, isAutoTimerEnabled, defaultRestDuration]);

  // Calculate volume & sets for summary
  const handleFinishPress = () => {
    let totalVolume = 0;
    let totalSets   = 0;
    
    activeExercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) {
          const w = parseFloat(set.weight) || 0;
          const r = parseInt(set.reps, 10) || 0;
          totalVolume += w * r;
          totalSets   += 1;
        }
      });
    });

    if (totalSets === 0) {
      Alert.alert(
        'Discard Workout?',
        "You haven't completed any sets yet. Would you like to discard this workout instead?",
        [
          { text: 'Keep Tracking', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setActiveExercises([]);
              onDiscard();
            },
          },
        ]
      );
      return;
    }

    const durationSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
    playWorkoutCompletedSound();
    onFinish({
      totalVolume,
      totalSets,
      durationMin: Math.max(1, Math.round(durationSec / 60)),
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
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveExercises(prev => prev.filter((_, idx) => idx !== activeExerciseMenuIndex));
              setIsExMenuVisible(false);
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
      let weightVal = '60';
      let repsVal = '10';

      if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
        const suggestion = getProgressiveOverloadSuggestions(exName, sessions);
        if (suggestion) {
          weightVal = suggestion.weight;
          repsVal = suggestion.reps;
        } else {
          const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
          if (libEx) {
            weightVal = (libEx.bestWeight || 60).toString();
            repsVal = (libEx.bestReps || 10).toString();
          }
        }
      } else {
        const previousSession = sessions?.find((s: any) =>
          s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase())
        );
        if (previousSession) {
          const found = previousSession.exercises.find((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase());
          if (found) {
            weightVal = (found.bestWeight || 60).toString();
            repsVal = (found.bestReps || 10).toString();
          }
        } else {
          const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
          if (libEx) {
            weightVal = (libEx.bestWeight || 60).toString();
            repsVal = (libEx.bestReps || 10).toString();
          }
        }
      }

      setActiveExercises(prev => prev.map((ex, idx) => {
        if (idx === activeExerciseMenuIndex) {
          return {
            id: ex.id,
            name: exName,
            sets: ex.sets.map(s => ({ ...s, weight: weightVal, reps: repsVal, completed: false })),
            superSetGroupId: ex.superSetGroupId,
          };
        }
        return ex;
      }));
      setActiveExerciseMenuIndex(null);
    } else {
      // Add mode: append all selected exercises
      const newOnes = names.map((exName, idx) => {
        let weightVal = '60';
        let repsVal = '10';
        let setsCount = 3;

        if (isProgressiveOverloadEnabled && sessions && sessions.length > 0) {
          const suggestion = getProgressiveOverloadSuggestions(exName, sessions);
          if (suggestion) {
            weightVal = suggestion.weight;
            repsVal = suggestion.reps;
            setsCount = suggestion.sets || 3;
          } else {
            const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
            if (libEx) {
              weightVal = (libEx.bestWeight || 60).toString();
              repsVal = (libEx.bestReps || 10).toString();
            }
          }
        } else {
          const previousSession = sessions?.find((s: any) =>
            s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase())
          );
          if (previousSession) {
            const found = previousSession.exercises.find((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase());
            if (found) {
              weightVal = (found.bestWeight || 60).toString();
              repsVal = (found.bestReps || 10).toString();
              setsCount = typeof found.sets === 'number' ? found.sets : (found.sets?.length || 3);
            }
          } else {
            const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exName.toLowerCase());
            if (libEx) {
              weightVal = (libEx.bestWeight || 60).toString();
              repsVal = (libEx.bestReps || 10).toString();
            }
          }
        }

        return {
          id: `ex-new-${idx}-${Date.now()}-${Math.random()}`,
          name: exName,
          sets: Array.from({ length: setsCount }).map((_, sIdx) => ({
            id: `set-${Date.now()}-${idx}-${sIdx}`,
            weight: weightVal,
            reps: repsVal,
            completed: false,
            category: 'S' as const,
          })),
        };
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveExercises(prev => [...prev, ...newOnes]);
    }
    setIsLibraryVisible(false);
  }, [isReplaceMode, activeExerciseMenuIndex, isProgressiveOverloadEnabled, sessions, exerciseLibrary]);

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

  // Static PanResponder map for reordering exercises (cached per item ID)
  const getExerciseDragHandlers = useCallback((itemKey: string) => {
    if (!exPanRespondersRef.current[itemKey]) {
      exPanRespondersRef.current[itemKey] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const currentIndex = exIndicesRef.current[itemKey];
          if (currentIndex !== undefined && currentIndex !== -1) {
            // Capture initial slot layout positions
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
            exDragY.setValue(0);
            if (Platform.OS !== 'web') Vibration.vibrate(20);
          }
        },
        onPanResponderMove: (_, gs) => {
          const yInitial = exInitialYRef.current;
          const currentIdx = exDragIdx.current;
          const yCurrent = exSlotYRef.current[currentIdx] !== undefined ? exSlotYRef.current[currentIdx] : yInitial;
          const translation = gs.dy + (yInitial - yCurrent);
          exDragY.setValue(translation);
          handleExerciseDragMoveRef.current(gs.dy);
        },
        onPanResponderRelease: () => {
          setExActiveKey(null);
          exDragIdx.current  = -1;
          exHoverIdx.current = -1;
          exDragY.setValue(0);
        },
        onPanResponderTerminate: () => {
          setExActiveKey(null);
          exDragIdx.current  = -1;
          exHoverIdx.current = -1;
          exDragY.setValue(0);
        },
      }).panHandlers;
    }
    return exPanRespondersRef.current[itemKey];
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
                  style={styles.minimizeBtn}
                  android_ripple={rippleTokens.borderless}
                  accessibilityLabel="Minimize workout screen"
                >
                  <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
                </Pressable>
                
                <Pressable
                  onPress={() => {
                    if (isTimerActive) {
                      setIsTimerActive(false);
                    } else {
                      setRestTimeRemaining(defaultRestDuration);
                      setIsTimerActive(true);
                    }
                  }}
                  style={[styles.headerStopwatchBtn, isTimerActive && styles.headerTimerBtnActive]}
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
                    style={styles.headerStopwatchBtn}
                    android_ripple={rippleTokens.surface}
                    accessibilityLabel="Open plate calculator"
                  >
                    <Ionicons name="disc-outline" size={18} color={colors.textPrimary} />
                  </Pressable>
                )}
              </View>

              <View style={[styles.headerCenter, { pointerEvents: 'none', flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Text style={styles.headerTimerText}>{elapsed}</Text>
                {isLiveHeartRateEnabled && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 }}>
                    <Ionicons name="heart" size={14} color={colors.error} />
                    <Text style={{ color: colors.error, fontSize: 13, fontFamily: font.bold }}>{heartRate}</Text>
                  </View>
                )}
              </View>

              <View style={styles.headerRight}>
                <Pressable
                  onPress={handleFinishPress}
                  style={styles.headerFinishBtn}
                  android_ripple={rippleTokens.accent}
                  accessibilityLabel="Finish workout"
                >
                  <Ionicons name="checkmark" size={14} color="#0D0F14" />
                  <Text style={styles.headerFinishBtnText}>FINISH</Text>
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
                  onPress={() => {
                    Alert.alert(
                      workoutName,
                      'Manage your active workout session.',
                      [
                        {
                          text: 'Discard Workout',
                          style: 'destructive',
                          onPress: handleDiscardPress,
                        },
                        {
                          text: 'Cancel',
                          style: 'cancel',
                        },
                      ]
                    );
                  }}
                  style={styles.workoutTitleOptionsBtn}
                  android_ripple={rippleTokens.borderless}
                  accessibilityLabel="Workout options"
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.accent} />
                </Pressable>
              </View>

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
                    <Animated.View
                      key={exItemKey}
                      onLayout={e => {
                        if (!isExActive) {
                          exItemLayouts.current[exItemKey] = {
                            y: e.nativeEvent.layout.y,
                            height: e.nativeEvent.layout.height,
                          };
                        }
                      }}
                      style={[
                        isExActive && {
                          transform:     [{ translateY: exDragY }],
                          zIndex:        999,
                          opacity:       0.88,
                          shadowColor:   '#000',
                          shadowOffset:  { width: 0, height: 8 },
                          shadowOpacity: 0.55,
                          shadowRadius:  16,
                          elevation:     14,
                        },
                      ]}
                    >
                    <SwipeableRow 
                      borderRadius={radius.md}
                      style={{ marginBottom: spacing.lg }}
                      onDelete={() => {
                        Alert.alert(
                          'Remove Exercise',
                          `Are you sure you want to remove "${exercise.name}"?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: () => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setActiveExercises(prev => prev.filter((_, idx) => idx !== exIdx));
                              }
                            }
                          ]
                        );
                      }}
                    >
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
                            {isSuperSet && (
                              <View style={[styles.superSetBadge, { borderColor: superSetColor, backgroundColor: superSetColor + '20' }]}>
                                <Text style={[styles.superSetBadgeText, { color: superSetColor }]}>SUPER SET</Text>
                              </View>
                            )}
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
                            <View
                              {...getExerciseDragHandlers(exItemKey)}
                              style={styles.dragHandle}
                              accessibilityLabel="Drag to reorder exercise"
                            >
                              <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
                            </View>
                          </View>
                        </View>

                        {(() => {
                          const libEx = exerciseLibrary?.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
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
                        {exercise.sets.map((set, setIdx) => {
                          const isPrevCompleted = setIdx > 0 && exercise.sets[setIdx - 1].completed;
                          const isNextCompleted = setIdx < exercise.sets.length - 1 && exercise.sets[setIdx + 1].completed;
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
                            />
                          );
                        })}

                        {/* Add Set Button */}
                        <Pressable
                          style={styles.addSetRow}
                          onPress={() => addSet(exIdx)}
                          android_ripple={rippleTokens.surface}
                        >
                          <Ionicons name="add" size={16} color={colors.accent} />
                          <Text style={styles.addSetText}>ADD SET</Text>
                        </Pressable>
                      </View>
                    </SwipeableRow>
                    </Animated.View>
                  );
                })
              )}

              {/* Add Exercise dynamically to active workout */}
              <Pressable
                style={styles.scrollAddExBtn}
                onPress={handleOpenAddExercise}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} style={{ marginRight: spacing.xs }} />
                <Text style={styles.scrollAddExText}>ADD EXERCISE</Text>
              </Pressable>

              {/* Discard Workout button */}
              <Pressable
                style={styles.scrollDiscardBtn}
                onPress={handleDiscardPress}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} style={{ marginRight: spacing.xs }} />
                <Text style={styles.scrollDiscardText}>DISCARD WORKOUT</Text>
              </Pressable>
            </ScrollView>



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
                  <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.sheetTitle}>
                      {activeExercises[activeExerciseMenuIndex].name.toUpperCase()}
                    </Text>
                    
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

                    <Pressable
                      style={[styles.sheetItem, styles.sheetCancel]}
                      onPress={() => setIsExMenuVisible(false)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={styles.sheetCancelText}>Cancel</Text>
                    </Pressable>
                  </Pressable>
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
                                {calculatedPlates.map((plate, idx) => {
                                  const scaleFactor = plate.size >= 25 ? 1.0 : plate.size >= 20 ? 0.93 : plate.size >= 15 ? 0.86 : plate.size >= 10 ? 0.79 : plate.size >= 5 ? 0.72 : 0.65;
                                  const heightVal = 86 * scaleFactor;
                                  const widthVal = 13 * scaleFactor;
                                  
                                  return (
                                    <View
                                      key={idx}
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
            <CustomWorkoutKeyboard
              visible={activeInput !== null}
              inputKey={activeInput ? `${activeInput.exIdx}-${activeInput.setIdx}-${activeInput.fieldName}-${activeInput.focusTime || 0}` : ''}
              value={
                activeInput
                  ? activeExercises[activeInput.exIdx]?.sets[activeInput.setIdx]?.[activeInput.fieldName] || ''
                  : ''
              }
              onChange={(newValue) => {
                if (activeInput) {
                  updateSetField(activeInput.exIdx, activeInput.setIdx, activeInput.fieldName, newValue);
                }
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
              onNext={handleNextField}
              onClose={() => setActiveInput(null)}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
  activeInput: { exIdx: number; setIdx: number; fieldName: 'weight' | 'reps'; focusTime?: number } | null;
  onFocus: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps') => void;
  updateSetField: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps' | 'rpe' | 'category', value: string) => void;
  deleteSet: (exIdx: number, setIdx: number) => void;
  toggleSetComplete: (exIdx: number, setIdx: number) => void;
  inputRefs: React.MutableRefObject<{ [key: string]: any }>;
  isPrevCompleted: boolean;
  isNextCompleted: boolean;
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
}) => {
  const isWeightFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'weight';
  const isRepsFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'reps';

  const isCompleted = set.completed;
  const showPrevConnected = isCompleted && isPrevCompleted;
  const showNextConnected = isCompleted && isNextCompleted;

  const rowStyle = {
    borderTopLeftRadius: showPrevConnected ? 0 : radius.xs,
    borderTopRightRadius: showPrevConnected ? 0 : radius.xs,
    borderBottomLeftRadius: showNextConnected ? 0 : radius.xs,
    borderBottomRightRadius: showNextConnected ? 0 : radius.xs,
  };

  return (
    <SwipeableRow
      onDelete={() => deleteSet(exIdx, setIdx)}
      borderRadius={radius.xs}
      style={{
        marginBottom: showNextConnected ? 0 : 4,
        ...rowStyle,
      }}
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
          onLongPress={() => deleteSet(exIdx, setIdx)}
          accessibilityLabel={`Cycle set category, long press to delete set ${setIdx + 1}`}
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
            value={set.weight}
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
              value={set.reps}
              onFocus={() => onFocus(exIdx, setIdx, 'reps')}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              editable={!set.completed}
              selectTextOnFocus
            />
            {set.rpe ? (
              <Text style={styles.rpeInlineText}>
                {`@${set.rpe}`}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Done Button */}
        <Pressable
          style={[styles.colCheck, styles.checkButton]}
          onPress={() => toggleSetComplete(exIdx, setIdx)}
        >
          <View
            style={[
              styles.checkCircle,
              set.completed && styles.checkCircleCompleted,
            ]}
          >
            {set.completed && (
              <Ionicons name="checkmark" size={14} color="#0D0F14" />
            )}
          </View>
        </Pressable>
      </View>
    </SwipeableRow>
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
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerFinishBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    columnGap:         6,
    backgroundColor:   colors.accent,
    borderRadius:      radius.full,
    paddingVertical:   7,
    paddingHorizontal: spacing.md,
    ...( shadow.accentGlow as object),
  },
  headerFinishBtnText: {
    color:         '#0D0F14',
    fontSize:      font.sizes.sm,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
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
    padding: spacing.xs,
    marginRight: -4,
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
    height:         32,
    justifyContent: 'center',
  },
  checkCircle: {
    width:           20,
    height:          20,
    borderRadius:    10,
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

  // Add Exercise Button
  scrollAddExBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.bg,
    borderColor:     colors.accent + '60',
    borderWidth:     1,
    borderStyle:     'dashed',
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    marginTop:       spacing.sm,
    marginBottom:    spacing.sm,
  },
  scrollAddExText: {
    color:         colors.accent,
    fontSize:      font.sizes.sm,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    rowGap: spacing.md,
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
    backgroundColor: colors.error + '20',
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
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
    elevation: 3,
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

  // SwipeableRow styles
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeDeleteAction: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    right:           0,
    left:            0,
    backgroundColor: colors.error,
    justifyContent:  'center',
    alignItems:      'flex-end',
    paddingRight:    spacing.lg,
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
});

export default ActiveWorkoutModal;
