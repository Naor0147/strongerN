// src/screens/E2EAppHarness.tsx
// Beautiful OLED-first test harness for ActiveWorkoutModal E2E tests

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, spacing, radius, shadow } from '../theme';
import { mockExercises, mockSessions, mockTemplates, ExerciseSet, Exercise, WorkoutSession } from '../data/mockData';
import ActiveWorkoutModal from '../components/layout/ActiveWorkoutModal';
import { initSounds } from '../utils/soundPlayer';
import { initNotifications, getLastNotificationResponse, onNotificationTapped, isWorkoutNotificationResponse } from '../utils/notifications';
import * as SplashScreen from 'expo-splash-screen';

import { Platform } from 'react-native';
import { initDb, saveToDb, loadFromDb, deleteFromDb } from '../utils/db';

interface LogItem {
  id: string;
  time: string;
  message: string;
}

let idCounter = 0;
const nextId = (prefix: string = 'id'): string => {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
};

export default function E2EAppHarness() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    ...Ionicons.font,
  });

  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFontTimeout(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Eagerly activate the iOS audio session on mount so the first
  // set-complete chime has zero latency.
  useEffect(() => {
    initSounds();
    initNotifications();
  }, []);

  // State for active workout
  const [isWorkoutModalVisible, setIsWorkoutModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onNotificationTapped((response) => {
      if (isWorkoutNotificationResponse(response)) {
        setIsWorkoutModalVisible(true);
      }
    });

    let active = true;
    (async () => {
      const last = await getLastNotificationResponse();
      if (active && last && isWorkoutNotificationResponse(last)) {
        setIsWorkoutModalVisible(true);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [workoutName, setWorkoutName] = useState('Empty Workout');
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [workoutExercises, setWorkoutExercises] = useState<ExerciseSet[]>([]);
  const [activeWorkoutComment, setActiveWorkoutComment] = useState('');
  const [defaultRestDuration, setDefaultRestDuration] = useState(90);
  const [isDataRestored, setIsDataRestored] = useState(false);

  // Lists
  const [exercisesList, setExercisesList] = useState<Exercise[]>(mockExercises);
  const [sessionsList, setSessionsList] = useState<WorkoutSession[]>(mockSessions);

  // Settings
  const [isAutoTimerEnabled, setIsAutoTimerEnabled] = useState(true);
  const [isLiveHeartRateEnabled, setIsLiveHeartRateEnabled] = useState(true);

  const [isProgressiveOverloadEnabled, setIsProgressiveOverloadEnabled] = useState(true);
  const [isAutoFinishSetEnabled, setIsAutoFinishSetEnabled] = useState(true);

  const [isRpeMode, setIsRpeMode] = useState(true);
  const [exerciseNameLanguage, setExerciseNameLanguage] = useState<'en' | 'he'>('en');

  // Logs
  const [logs, setLogs] = useState<LogItem[]>([]);

  const addLog = useCallback((message: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs((prev) => [{ id: nextId('log'), time: timeStr, message }, ...prev.slice(0, 29)]);
  }, []);

  // Restore active workout state on mount
  useEffect(() => {
    async function restoreActiveWorkout() {
      try {
        await initDb();
        const savedWorkout = await loadFromDb('strongern_active_workout_state');
        console.log('[HARNESS RESTORE] loaded savedWorkout:', savedWorkout ? JSON.stringify(savedWorkout) : 'null');
        if (savedWorkout && savedWorkout.isWorkoutActive !== false && (savedWorkout.workoutName || savedWorkout.startTime)) {
          setIsWorkoutActive(true);
          if (savedWorkout.workoutName) setWorkoutName(savedWorkout.workoutName);
          if (savedWorkout.startTime) setStartTime(new Date(savedWorkout.startTime));
          if (Array.isArray(savedWorkout.workoutExercises)) setWorkoutExercises(savedWorkout.workoutExercises);
          setIsWorkoutModalVisible(savedWorkout.isWorkoutModalVisible !== undefined ? savedWorkout.isWorkoutModalVisible : true);
          if (savedWorkout.comment !== undefined) setActiveWorkoutComment(savedWorkout.comment || '');
          addLog('Restored active workout from storage');
        }
      } catch (e) {
        console.warn('Error restoring active workout state in E2E harness:', e);
      } finally {
        setIsDataRestored(true);
      }
    }
    restoreActiveWorkout();
  }, [addLog]);

  // Persist active workout state on changes
  const activeWorkoutStateRef = useRef<any>(null);

  useEffect(() => {
    if (isWorkoutActive) {
      activeWorkoutStateRef.current = {
        isWorkoutActive: true,
        workoutName,
        startTime: startTime.toISOString(),
        workoutExercises,
        isWorkoutModalVisible,
        comment: activeWorkoutComment,
      };
    } else {
      activeWorkoutStateRef.current = null;
    }
  }, [isWorkoutActive, workoutName, startTime, workoutExercises, isWorkoutModalVisible, activeWorkoutComment]);

  const flushSave = useCallback(() => {
    if (activeWorkoutStateRef.current) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('strongern_active_workout_state', JSON.stringify(activeWorkoutStateRef.current));
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleBeforeUnload = () => {
      flushSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushSave]);

  useEffect(() => {
    if (!isDataRestored) return;

    if (isWorkoutActive && activeWorkoutStateRef.current) {
      saveToDb('strongern_active_workout_state', activeWorkoutStateRef.current);
    }
  }, [isWorkoutActive, workoutName, startTime, workoutExercises, isWorkoutModalVisible, activeWorkoutComment, isDataRestored]);

  const handleStartEmptyWorkout = () => {
    setWorkoutName('Empty Workout');
    setStartTime(new Date());
    setWorkoutExercises([]);
    setActiveWorkoutComment('');
    setIsWorkoutActive(true);
    setIsWorkoutModalVisible(true);
    addLog('Started Empty Workout');
  };

  const handleStartLargeWorkout = () => {
    const tpl = {
      id: 'tpl-large',
      name: 'Extreme Heavy 20-Exercise Workout',
      exercises: [
        'Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Push-ups',
        'Overhead Press', 'Lateral Raise', 'Dumbbell Front Raise', 'Rear Delt Fly',
        'Barbell Row', 'Lat Pulldown', 'Dumbbell Row', 'Face Pull',
        'Bicep Curl', 'Hammer Curl', 'Tricep Extension', 'Skull Crushers',
        'Back Squat', 'Leg Press', 'Leg Extension', 'Standing Calf Raise'
      ],
      exercisesDetails: Array.from({ length: 20 }).map((_, exIdx) => {
        const names = [
          'Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Push-ups',
          'Overhead Press', 'Lateral Raise', 'Dumbbell Front Raise', 'Rear Delt Fly',
          'Barbell Row', 'Lat Pulldown', 'Dumbbell Row', 'Face Pull',
          'Bicep Curl', 'Hammer Curl', 'Tricep Extension', 'Skull Crushers',
          'Back Squat', 'Leg Press', 'Leg Extension', 'Standing Calf Raise'
        ];
        const isUnilateral = [5, 6, 10, 13, 18].includes(exIdx);
        const superSetGroupId = (exIdx === 2 || exIdx === 3) ? 'ss-group-1' : (exIdx === 10 || exIdx === 11) ? 'ss-group-2' : undefined;
        const numSets = (exIdx === 5 || exIdx === 16 || exIdx === 19) ? 5 : 4;

        return {
          name: names[exIdx],
          superSetGroupId,
          sets: Array.from({ length: numSets }).map((__, setIdx) => ({
            weight: String(40 + (exIdx * 5) + (setIdx * 2)),
            reps: String(8 + (setIdx % 4)),
            category: setIdx === 0 ? 'W' : 'S',
            isUnilateral,
            leftWeight: isUnilateral ? String(20 + exIdx) : undefined,
            leftReps: isUnilateral ? String(10) : undefined,
            rightWeight: isUnilateral ? String(20 + exIdx) : undefined,
            rightReps: isUnilateral ? String(10) : undefined,
          }))
        };
      })
    };
    setWorkoutName(tpl.name);
    setStartTime(new Date());
    
    const initialExercises: any[] = (tpl.exercisesDetails || []).map(ed => {
      return {
        name: ed.name,
        sets: ed.sets.length,
        bestWeight: 70,
        bestReps: 10,
        superSetGroupId: ed.superSetGroupId,
        useRoutineTargets: (tpl as any).useRoutineTargets || false,
        setsDetails: ed.sets.map(s => {
          const w = s.weight ? parseFloat(s.weight) : NaN;
          const r = s.reps ? parseInt(s.reps, 10) : NaN;
          const lw = s.leftWeight ? parseFloat(s.leftWeight) : undefined;
          const lr = s.leftReps ? parseInt(s.leftReps, 10) : undefined;
          const rw = s.rightWeight ? parseFloat(s.rightWeight) : undefined;
          const rr = s.rightReps ? parseInt(s.rightReps, 10) : undefined;
          return {
            weight: Number.isFinite(w) && w > 0 ? String(w) : '',
            reps: Number.isFinite(r) && r > 0 ? String(r) : '',
            completed: false,
            category: (s.category && ['W', 'S', 'D', 'F'].includes(s.category) ? s.category : 'S') as 'W' | 'S' | 'D' | 'F',
            isUnilateral: s.isUnilateral || false,
            leftWeight: lw !== undefined && Number.isFinite(lw) && lw > 0 ? String(lw) : undefined,
            leftReps: lr !== undefined && Number.isFinite(lr) && lr > 0 ? String(lr) : undefined,
            rightWeight: rw !== undefined && Number.isFinite(rw) && rw > 0 ? String(rw) : undefined,
            rightReps: rr !== undefined && Number.isFinite(rr) && rr > 0 ? String(rr) : undefined,
          };
        })
      };
    });

    setWorkoutExercises(initialExercises);
    setActiveWorkoutComment('');
    setIsWorkoutActive(true);
    setIsWorkoutModalVisible(true);
    addLog(`Started Heavy Workout: ${tpl.name}`);
  };

  const handleStartTemplateWorkout = () => {
    const tpl = mockTemplates[0];
    setWorkoutName(tpl.name);
    setStartTime(new Date());
    
    // Convert template exercisesDetails to ExerciseSet[]
    const initialExercises: any[] = (tpl.exercisesDetails || []).map(ed => {
      return {
        name: ed.name,
        sets: ed.sets.length,
        bestWeight: 70,
        bestReps: 10,
        useRoutineTargets: (tpl as any).useRoutineTargets || false,
        setsDetails: ed.sets.map(s => {
          const w = s.weight ? parseFloat(s.weight) : NaN;
          const r = s.reps ? parseInt(s.reps, 10) : NaN;
          const lw = s.leftWeight ? parseFloat(s.leftWeight) : undefined;
          const lr = s.leftReps ? parseInt(s.leftReps, 10) : undefined;
          const rw = s.rightWeight ? parseFloat(s.rightWeight) : undefined;
          const rr = s.rightReps ? parseInt(s.rightReps, 10) : undefined;
          return {
            weight: Number.isFinite(w) && w > 0 ? String(w) : '',
            reps: Number.isFinite(r) && r > 0 ? String(r) : '',
            completed: false,
            category: (s.category && ['W', 'S', 'D', 'F'].includes(s.category) ? s.category : 'S') as 'W' | 'S' | 'D' | 'F',
            isUnilateral: s.isUnilateral || false,
            leftWeight: lw !== undefined && Number.isFinite(lw) && lw > 0 ? String(lw) : undefined,
            leftReps: lr !== undefined && Number.isFinite(lr) && lr > 0 ? String(lr) : undefined,
            rightWeight: rw !== undefined && Number.isFinite(rw) && rw > 0 ? String(rw) : undefined,
            rightReps: rr !== undefined && Number.isFinite(rr) && rr > 0 ? String(rr) : undefined,
          };
        })
      };
    });

    setWorkoutExercises(initialExercises);
    setActiveWorkoutComment('');
    setIsWorkoutActive(true);
    setIsWorkoutModalVisible(true);
    addLog(`Started Template Workout: ${tpl.name}`);
  };

  const handleFinishWorkout = (summary: { totalVolume: number; totalSets: number; durationMin: number; comment?: string }) => {
    activeWorkoutStateRef.current = null;
    setIsWorkoutModalVisible(false);
    setIsWorkoutActive(false);
    deleteFromDb('strongern_active_workout_state');
    addLog(`Finished Workout! Volume: ${summary.totalVolume}kg, Sets: ${summary.totalSets}, Duration: ${summary.durationMin}m, Note: ${summary.comment || 'None'}`);
    
    // Save to session history
    const newSession: WorkoutSession = {
      id: nextId('session'),
      title: workoutName,
      datetime: new Date(startTime.getTime()),
      comment: summary.comment,
      exercises: JSON.parse(JSON.stringify(workoutExercises)),
      durationMinutes: summary.durationMin,
      totalVolumeKg: summary.totalVolume,
      prs: 0
    };
    setSessionsList(prev => [newSession, ...prev]);
  };

  const handleDiscardWorkout = () => {
    setIsWorkoutModalVisible(false);
    setIsWorkoutActive(false);
    deleteFromDb('strongern_active_workout_state');
    addLog('Discarded Workout session');
  };

  const handleAddCustomExercise = (name: string, muscle: string, equipment?: string, isUnilateral?: boolean) => {
    const newEx: Exercise = {
      id: nextId('ex-custom'),
      name,
      muscleGroup: muscle,
      allTimeSets: 0,
      equipment: equipment || 'Other',
      isUnilateral,
    };
    setExercisesList(prev => [newEx, ...prev]);
    addLog(`Created Custom Exercise: ${name} (${muscle})${isUnilateral ? ' · unilateral' : ''}`);
    return newEx;
  };



  if (!fontsLoaded && !fontError && !fontTimeout) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>strongerN Testing</Text>
              <Text style={styles.subtitle}>ActiveWorkoutModal Sandbox</Text>
            </View>

            {/* Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Start Session</Text>
              <View style={styles.controlsRow}>
                <Pressable
                  style={[styles.controlBtn, styles.btnStart]}
                  onPress={handleStartEmptyWorkout}
                  testID="start-empty-workout"
                >
                  <Text style={styles.controlBtnText}>Start Empty Workout</Text>
                </Pressable>

                <Pressable
                  style={[styles.controlBtn, styles.btnTemplate]}
                  onPress={handleStartTemplateWorkout}
                  testID="start-template-workout"
                >
                  <Text style={styles.controlBtnText}>Start "Push & Pull"</Text>
                </Pressable>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Pressable
                  style={[styles.controlBtn, styles.btnTemplate, { backgroundColor: colors.accent }]}
                  onPress={handleStartLargeWorkout}
                  testID="start-large-workout"
                >
                  <Text style={[styles.controlBtnText, { color: '#0D0F14' }]}>Start Heavy Workout (20 Ex / 80+ Sets)</Text>
                </Pressable>
              </View>
            </View>

            {/* Active Session Status */}
            {isWorkoutActive && (
              <View style={styles.activeStatusCard} testID="active-workout-bar">
                <View style={styles.statusRow}>
                  <View style={styles.pulsingIndicator} />
                  <Text style={styles.activeStatusText}>Workout In Progress: {workoutName}</Text>
                </View>
                <Pressable style={styles.resumeBtn} onPress={() => setIsWorkoutModalVisible(true)} testID="resume-workout-btn">
                  <Text style={styles.resumeBtnText}>Resume Active Session Sheet</Text>
                </Pressable>
              </View>
            )}

            {/* Callback Logs */}
            <View style={[styles.section, { flex: 1, marginBottom: 0 }]}>
              <View style={styles.logsHeader}>
                <Text style={styles.sectionTitle}>Sandbox Callback Logs</Text>
                <Pressable onPress={() => setLogs([])}>
                  <Text style={styles.clearLogsText}>Clear</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.logsContainer} contentContainerStyle={styles.logsContent}>
                {logs.length === 0 ? (
                  <Text style={styles.emptyLogsText}>No actions logged yet. Start a workout session above.</Text>
                ) : (
                  logs.map((log) => (
                    <View key={log.id} style={styles.logRow}>
                      <Text style={styles.logTime}>{log.time}</Text>
                      <Text style={styles.logMsg}>{log.message}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Active Workout Interactive Modal Sheet */}
            <ActiveWorkoutModal
              visible={isWorkoutModalVisible}
              workoutName={workoutName}
              startTime={startTime}
              exercises={workoutExercises}
              isAutoTimerEnabled={isAutoTimerEnabled}
              onClose={() => setIsWorkoutModalVisible(false)}
              onFinish={handleFinishWorkout}
              onDiscard={handleDiscardWorkout}
              exerciseLibrary={exercisesList}
              onUpdateActiveExercises={setWorkoutExercises}
              onUpdateExerciseNotes={(exId, notes) => {
                addLog(`onUpdateExerciseNotes: id=${exId}, notes=${notes}`);
                setExercisesList(prev => prev.map(ex => ex.id === exId ? { ...ex, notes } : ex));
              }}
              onUpdateExerciseInsightsNotes={(exId, insightsNotes) => {
                addLog(`onUpdateExerciseInsightsNotes: id=${exId}, insightsNotes=${insightsNotes}`);
                setExercisesList(prev => prev.map(ex => ex.id === exId ? { ...ex, insightsNotes } : ex));
              }}
              onAddCustomExercise={handleAddCustomExercise}
              isLiveHeartRateEnabled={isLiveHeartRateEnabled}

              defaultRestDuration={defaultRestDuration}
              onRenameWorkout={setWorkoutName}
              sessions={sessionsList}
              isProgressiveOverloadEnabled={isProgressiveOverloadEnabled}
              isAutoFinishSetEnabled={isAutoFinishSetEnabled}

              isRpeMode={isRpeMode}
              exerciseNameLanguage={exerciseNameLanguage}
              isEditing={false}
              editingComment={activeWorkoutComment}
              onUpdateComment={setActiveWorkoutComment}
              onUpdateStartTime={setStartTime}
              onUpdateDefaultRestDuration={setDefaultRestDuration}
            />

          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'flex-start',
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: font.sizes.xxl,
    fontFamily: font.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'none',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  controlBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  btnStart: {
    backgroundColor: colors.accent,
  },
  btnTemplate: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  controlBtnText: {
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
    color: colors.textPrimary,
  },
  activeStatusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pulsingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F0506E',
    marginRight: spacing.sm,
  },
  activeStatusText: {
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
    color: colors.textPrimary,
  },
  resumeBtn: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resumeBtnText: {
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
    color: colors.accent,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearLogsText: {
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
    color: colors.accent,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  logsContent: {
    padding: spacing.md,
  },
  logRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logTime: {
    fontFamily: font.regular,
    fontSize: font.sizes.xs,
    color: colors.textMuted,
    width: 70,
  },
  logMsg: {
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  emptyLogsText: {
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
