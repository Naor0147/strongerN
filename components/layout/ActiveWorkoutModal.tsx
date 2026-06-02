// components/layout/ActiveWorkoutModal.tsx
// Premium full-featured active workout tracking screen (Layout Optimized)
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../../theme';
import { ExerciseSet } from '../../data/mockData';
import IconButton from '../ui/IconButton';

interface SetRecord {
  id:        string;
  weight:    string;
  reps:      string;
  completed: boolean;
}

interface ActiveExercise {
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
}> = ({ children, onDelete, borderRadius = radius.xs }) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100) {
          Animated.timing(translateX, {
            toValue: -500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDelete();
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },
    })
  ).current;

  const bgOpacity = translateX.interpolate({
    inputRange: [-60, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ position: 'relative', overflow: 'hidden' }}>
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        left: 0,
        backgroundColor: colors.error,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingRight: spacing.md,
        borderRadius,
        marginVertical: 2,
        opacity: bgOpacity,
      }}>
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
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
}) => {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime));
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [workoutFinished, setWorkoutFinished] = useState(false);

  // Auto rest timer countdown states
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Exercise library selector modal states
  const [isLibraryVisible, setIsLibraryVisible] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeExerciseMenuIndex, setActiveExerciseMenuIndex] = useState<number | null>(null);
  const [isExMenuVisible, setIsExMenuVisible] = useState(false);
  const [isReplaceMode, setIsReplaceMode] = useState(false);

  const lastStartTimeRef = useRef<string | null>(null);

  // Sync props to state when modal becomes visible or when a new workout session actually starts
  useEffect(() => {
    if (visible && exercises.length > 0) {
      const startKey = startTime.toISOString();
      const isNewWorkout = lastStartTimeRef.current !== startKey;

      if (isNewWorkout || activeExercises.length === 0) {
        lastStartTimeRef.current = startKey;
        const initial = exercises.map((ex, exIdx) => {
          const setsCount = typeof ex.sets === 'number' ? ex.sets : 3;
          return {
            name: ex.name,
            sets: Array.from({ length: setsCount }).map((_, setIdx) => ({
              id:        `set-${exIdx}-${setIdx}-${Date.now()}`,
              weight:    ex.bestWeight.toString(),
              reps:      ex.bestReps.toString(),
              completed: false,
            })),
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
    if (onUpdateActiveExercises && activeExercises.length > 0) {
      const mapped = activeExercises.map(ex => {
        const completedSets = ex.sets.filter(s => s.completed);
        return {
          name: ex.name,
          sets: completedSets.length,
          bestWeight: completedSets.length > 0 ? Math.max(...completedSets.map(s => parseFloat(s.weight) || 0), 0) : 0,
          bestReps: completedSets.length > 0 ? Math.max(...completedSets.map(s => parseInt(s.reps, 10) || 0), 0) : 0,
          superSetGroupId: ex.superSetGroupId,
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
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(timerPulseAnim, {
          toValue:         0.4,
          duration:        500,
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
        Animated.timing(timerPulseAnim, {
          toValue:         1,
          duration:        500,
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isTimerActive, timerPulseAnim]);

  // Set completeness toggler
  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    setActiveExercises(prev => {
      const next = [...prev];
      const targetSet = next[exIdx].sets[setIdx];
      targetSet.completed = !targetSet.completed;

      // Auto Timer Trigger: when checked active (not unchecked)
      if (targetSet.completed && isAutoTimerEnabled) {
        setRestTimeRemaining(90); // 90 seconds rest time
        setIsTimerActive(true);
      }

      return next;
    });
  };

  // Set weight/reps updater
  const updateSetField = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setActiveExercises(prev => {
      const next = [...prev];
      next[exIdx].sets[setIdx][field] = value;
      return next;
    });
  };

  // Add a set
  const addSet = (exIdx: number) => {
    setActiveExercises(prev => {
      const next = [...prev];
      const currentSets = next[exIdx].sets;
      const lastSet = currentSets[currentSets.length - 1];
      const newSet: SetRecord = {
        id:        `set-${exIdx}-${Date.now()}`,
        weight:    lastSet?.weight ?? '60',
        reps:      lastSet?.reps ?? '10',
        completed: false,
      };
      next[exIdx].sets = [...currentSets, newSet];
      return next;
    });
  };

  // Delete a set
  const deleteSet = (exIdx: number, setIdx: number) => {
    setActiveExercises(prev => {
      const next = [...prev];
      next[exIdx].sets.splice(setIdx, 1);
      return next;
    });
  };

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
    onFinish({
      totalVolume,
      totalSets,
      durationMin: Math.max(1, Math.round(durationSec / 60)),
    });
  };

  const handleDiscardPress = () => {
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

  const handleSelectLibraryExercise = (exName: string) => {
    if (isReplaceMode && activeExerciseMenuIndex !== null) {
      setActiveExercises(prev => prev.map((ex, idx) => {
        if (idx === activeExerciseMenuIndex) {
          return {
            name: exName,
            sets: ex.sets.map(s => ({ ...s, completed: false })),
            superSetGroupId: ex.superSetGroupId,
          };
        }
        return ex;
      }));
      setActiveExerciseMenuIndex(null);
    } else {
      // Add new exercise
      const newActive = {
        name: exName,
        sets: [
          { id: `set-${Date.now()}-0`, weight: '60', reps: '10', completed: false },
          { id: `set-${Date.now()}-1`, weight: '60', reps: '10', completed: false },
          { id: `set-${Date.now()}-2`, weight: '60', reps: '10', completed: false },
        ]
      };
      setActiveExercises(prev => [...prev, newActive]);
    }
    setIsLibraryVisible(false);
  };

  // Search filtered library exercises
  const filteredLibrary = useMemo(() => {
    if (!librarySearch.trim()) return exerciseLibrary;
    return exerciseLibrary.filter(ex => ex.name.toLowerCase().includes(librarySearch.toLowerCase().trim()));
  }, [exerciseLibrary, librarySearch]);

  return (
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
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
                      setRestTimeRemaining(90);
                      setIsTimerActive(true);
                    }
                  }}
                  style={styles.headerStopwatchBtn}
                  android_ripple={rippleTokens.surface}
                  accessibilityLabel="Toggle rest timer"
                >
                  <Ionicons name="stopwatch-outline" size={18} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={[styles.headerCenter, { pointerEvents: 'none' }]}>
                <Text style={styles.headerTimerText}>{elapsed}</Text>
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
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                isTimerActive ? { paddingBottom: spacing.xxxl * 3 } : { paddingBottom: spacing.xxl }
              ]}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
            >
              {/* Workout Title Section */}
              <View style={styles.workoutTitleSection}>
                <Text style={styles.workoutTitleText}>{workoutName}</Text>
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
                <>
                  {activeExercises.map((exercise, exIdx) => {
                    const isSuperSet = !!exercise.superSetGroupId;
                    return (
                      <SwipeableRow 
                        key={exercise.name + '-' + exIdx} 
                        borderRadius={radius.md}
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
                                  setActiveExercises(prev => prev.filter((_, idx) => idx !== exIdx));
                                }
                              }
                            ]
                          );
                        }}
                      >
                        <View style={[
                          styles.exerciseCard,
                          isSuperSet && { borderLeftWidth: 4, borderLeftColor: colors.accent }
                        ]}>
                          <View style={styles.exerciseHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm }}>
                              <Text style={styles.exerciseName}>{exercise.name}</Text>
                              {isSuperSet && (
                                <View style={styles.superSetBadge}>
                                  <Text style={styles.superSetBadgeText}>SUPER SET</Text>
                                </View>
                              )}
                            </View>
                            <Pressable
                              onPress={() => handleExerciseMenuPress(exIdx)}
                              style={styles.exEllipsis}
                              android_ripple={rippleTokens.borderless}
                            >
                              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                            </Pressable>
                          </View>

                          {/* Sets Column Headers */}
                          <View style={styles.tableHeader}>
                            <Text style={[styles.columnLabel, styles.colSet]}>SET</Text>
                            <Text style={[styles.columnLabel, styles.colWeight]}>KG</Text>
                            <Text style={[styles.columnLabel, styles.colReps]}>REPS</Text>
                            <Text style={[styles.columnLabel, styles.colCheck, { textAlign: 'center' }]}>DONE</Text>
                          </View>

                          {/* Sets Row List */}
                          {exercise.sets.map((set, setIdx) => (
                            <SwipeableRow key={set.id} onDelete={() => deleteSet(exIdx, setIdx)} borderRadius={radius.xs}>
                              <View
                                style={[
                                  styles.setRow,
                                  set.completed && styles.setRowCompleted,
                                ]}
                              >
                                {/* Set Number */}
                                <Pressable
                                  style={[styles.colSet, styles.setNumCol]}
                                  onLongPress={() => deleteSet(exIdx, setIdx)}
                                  accessibilityLabel={`Long press to delete set ${setIdx + 1}`}
                                >
                                  <Text
                                    style={[
                                      styles.setNumText,
                                      set.completed && styles.textCompleted,
                                    ]}
                                  >
                                    {setIdx + 1}
                                  </Text>
                                </Pressable>

                                {/* Weight Input */}
                                <View style={[styles.colWeight, styles.inputWrapper]}>
                                  <TextInput
                                    style={[
                                      styles.input,
                                      set.completed && styles.inputCompleted,
                                    ]}
                                    keyboardType="numeric"
                                    value={set.weight}
                                    onChangeText={val => updateSetField(exIdx, setIdx, 'weight', val)}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!set.completed}
                                    selectTextOnFocus
                                  />
                                </View>

                                {/* Reps Input */}
                                <View style={[styles.colReps, styles.inputWrapper]}>
                                  <TextInput
                                    style={[
                                      styles.input,
                                      set.completed && styles.inputCompleted,
                                    ]}
                                    keyboardType="numeric"
                                    value={set.reps}
                                    onChangeText={val => updateSetField(exIdx, setIdx, 'reps', val)}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!set.completed}
                                    selectTextOnFocus
                                  />
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
                          ))}

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
                    );
                  })}

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
                </>
              )}
            </ScrollView>

            {/* ── Floating Rest Timer Widget ───────────────────────── */}
            {isTimerActive && (
              <View style={styles.timerWidget}>
                <View style={styles.timerWidgetLeft}>
                  <Animated.View style={{ opacity: timerPulseAnim }}>
                    <Ionicons name="hourglass" size={18} color={colors.gold} />
                  </Animated.View>
                  <View style={{ marginLeft: spacing.sm }}>
                    <Text style={styles.timerWidgetTitle}>REST TIMER</Text>
                    <Text style={styles.timerWidgetTime}>
                      {Math.floor(restTimeRemaining / 60)}:{(restTimeRemaining % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.timerWidgetRight}>
                  <Pressable
                    style={styles.timerWidgetBtn}
                    onPress={() => setRestTimeRemaining(prev => Math.max(0, prev - 30))}
                    android_ripple={rippleTokens.surface}
                  >
                    <Text style={styles.timerWidgetBtnText}>-30s</Text>
                  </Pressable>

                  <Pressable
                    style={styles.timerWidgetBtn}
                    onPress={() => setRestTimeRemaining(prev => prev + 30)}
                    android_ripple={rippleTokens.surface}
                  >
                    <Text style={styles.timerWidgetBtnText}>+30s</Text>
                  </Pressable>
                  
                  <Pressable
                    style={[styles.timerWidgetBtn, { borderColor: colors.border }]}
                    onPress={() => setIsTimerActive(false)}
                    android_ripple={rippleTokens.surface}
                  >
                    <Text style={[styles.timerWidgetBtnText, { color: colors.textSecondary }]}>Skip</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Modal A: Exercise Library Picker */}
            <Modal
              visible={isLibraryVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setIsLibraryVisible(false)}
            >
              <View style={styles.backdrop}>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                      {isReplaceMode ? 'REPLACE EXERCISE' : 'ADD EXERCISE'}
                    </Text>
                    <IconButton
                      name="close"
                      size={22}
                      color={colors.textSecondary}
                      onPress={() => setIsLibraryVisible(false)}
                    />
                  </View>

                  <View style={styles.searchBarContainer}>
                    <Ionicons name="search" size={16} color={colors.textSecondary} />
                    <TextInput
                      style={styles.librarySearchInput}
                      placeholder="Search movements..."
                      placeholderTextColor={colors.textMuted}
                      value={librarySearch}
                      onChangeText={setLibrarySearch}
                      keyboardAppearance="dark"
                    />
                  </View>

                  <FlatList
                    data={filteredLibrary}
                    keyExtractor={item => item.id}
                    style={styles.libraryList}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => handleSelectLibraryExercise(item.name)}
                        style={styles.libraryItem}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={styles.libraryItemText}>{item.name}</Text>
                        <Text style={styles.libraryMuscleText}>{item.muscleGroup.toUpperCase()}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              </View>
            </Modal>

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
                  <View style={styles.sheetCard}>
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
                  </View>
                </Pressable>
              </Modal>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

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
    width:           36,
    height:          36,
    borderRadius:    radius.xs,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.border,
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
    marginBottom:    spacing.lg,
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

  // Table Headers
  tableHeader: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
    paddingRight:  4,
  },
  columnLabel: {
    color:      colors.textMuted,
    fontSize:   10,
    fontFamily: font.semibold,
  },

  // Columns Layout
  colSet: {
    width:      45,
    textAlign:  'center',
  },
  colWeight: {
    flex:       1.2,
    marginRight: spacing.sm,
  },
  colReps: {
    flex:       1,
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
    marginBottom:    4,
    backgroundColor: colors.surface,
  },
  setRowCompleted: {
    backgroundColor: '#172528', // Solid dark green-slate blend to keep it opaque
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
    borderColor:     colors.success,
    backgroundColor: colors.success,
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

  // Rest Timer Widget
  timerWidget: {
    position:        'absolute',
    bottom:          24,
    left:            spacing.lg,
    right:           spacing.lg,
    backgroundColor: colors.surfaceHigh,
    borderColor:     colors.accent,
    borderWidth:     1.5,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    ...(shadow.lg as object),
  },
  timerWidgetLeft: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  timerWidgetTitle: {
    color:         colors.accent,
    fontSize:      9,
    fontFamily:    font.semibold,
    letterSpacing: 1.2,
  },
  timerWidgetTime: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.lg,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginTop:  1,
  },
  timerWidgetRight: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.sm,
  },
  timerWidgetBtn: {
    borderColor:     colors.borderStrong,
    borderWidth:     1,
    borderRadius:    radius.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  timerWidgetBtnText: {
    color:      colors.accent,
    fontSize:   font.sizes.xs,
    fontFamily: font.bold,
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
});

export default ActiveWorkoutModal;
