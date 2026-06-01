// components/layout/ActiveWorkoutModal.tsx
// Premium full-featured active workout tracking screen (Layout Optimized)
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../../theme';
import { ExerciseSet } from '../../data/mockData';

interface SetRecord {
  id:        string;
  weight:    string;
  reps:      string;
  completed: boolean;
}

interface ActiveExercise {
  name: string;
  sets: SetRecord[];
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
}

function formatElapsed(startTime: Date): string {
  const totalSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const h   = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${min}:${sec}` : `${min}:${sec}`;
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
}) => {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime));
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [workoutFinished, setWorkoutFinished] = useState(false);

  // Auto rest timer countdown states
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Sync props to state when modal becomes visible
  useEffect(() => {
    if (visible && exercises.length > 0) {
      const initial = exercises.map((ex, exIdx) => ({
        name: ex.name,
        sets: Array.from({ length: ex.sets }).map((_, setIdx) => ({
          id:        `set-${exIdx}-${setIdx}`,
          weight:    ex.bestWeight.toString(),
          reps:      ex.bestReps.toString(),
          completed: false,
        })),
      }));
      setActiveExercises(initial);
      setWorkoutFinished(false);
      setIsTimerActive(false); // Reset timer when modal starts
    }
  }, [visible, exercises]);

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

  // Pulsing active green dot (reserved for header if ever needed, currently unused)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue:         0.2,
          duration:        800,
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue:         1,
          duration:        800,
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible, pulseAnim]);

  // Pulsing timer icon when rest timer is active
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
        setRestTimeRemaining(90); // 90 seconds (1m 30s) standard rest time
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
        'Finish Workout?',
        'You haven\'t completed any sets yet. Do you still want to finish this session?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Finish',
            onPress: () => {
              const durationSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
              onFinish({
                totalVolume: 0,
                totalSets:   0,
                durationMin: Math.max(1, Math.round(durationSec / 60)),
              });
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
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false} // Pure full-screen
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
              {/* Left Section: Chevron + Stopwatch */}
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
                      setRestTimeRemaining(90); // default 90s
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

              {/* Center Section: Perfectly Centered Timer */}
              <View style={styles.headerCenter}>
                <Text style={styles.headerTimerText}>{elapsed}</Text>
              </View>

              {/* Right Section: Plain Text Uppercase FINISH Button */}
              <View style={styles.headerRight}>
                <Pressable
                  onPress={handleFinishPress}
                  style={styles.headerFinishTextBtn}
                  android_ripple={rippleTokens.borderless}
                >
                  <Text style={styles.headerFinishTextBtnText}>FINISH</Text>
                </Pressable>
              </View>
            </View>

            {/* ── Scrollable Exercises List ────────────────────────── */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                isTimerActive ? { paddingBottom: spacing.xxxl * 2.5 } : { paddingBottom: spacing.xxl }
              ]}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
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
                  {activeExercises.map((exercise, exIdx) => (
                    <View key={exercise.name} style={styles.exerciseCard}>
                      <View style={styles.exerciseHeader}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
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
                        <View
                          key={set.id}
                          style={[
                            styles.setRow,
                            set.completed && styles.setRowCompleted,
                          ]}
                        >
                          {/* Set Number */}
                          <Pressable
                            style={[styles.colSet, styles.setNumCol]}
                            onLongPress={() => deleteSet(exIdx, setIdx)}
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
                  ))}

                  {/* Discard Workout button at the bottom of the ScrollView */}
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
    overflow:        'hidden',
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
  headerFinishTextBtn: {
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  headerFinishTextBtnText: {
    color:         colors.accent,
    fontSize:      font.sizes.md,
    fontFamily:    font.bold,
    letterSpacing: 0.5,
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
  },
  setRowCompleted: {
    backgroundColor: colors.successGlow + '0F', // very subtle green overlay
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
    backgroundColor: 'transparent',
    borderColor:     'transparent',
    color:           colors.success,
  },
  textCompleted: {
    color: colors.success,
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
    marginTop:       spacing.sm,
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
    bottom:          24, // Floating beautifully near the bottom of the device screen
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
});

export default ActiveWorkoutModal;
