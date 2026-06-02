// App.tsx — Navigation root with font loading, live workout state, and completion celebrations
import React from 'react';
import { View, StyleSheet, ActivityIndicator, Modal, Text, Pressable } from 'react-native';
import { NavigationContainer }      from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider }         from 'react-native-safe-area-context';
import { StatusBar }                from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Ionicons }                 from '@expo/vector-icons';

// Design tokens
import { colors, spacing, radius, font, shadow, ripple as rippleTokens } from './theme';

// Layout components
import BottomTabBar      from './components/layout/BottomTabBar';
import ActiveWorkoutBar  from './components/layout/ActiveWorkoutBar';
import ActiveWorkoutModal from './components/layout/ActiveWorkoutModal';

// Screens
import ProfileScreen   from './screens/ProfileScreen';
import HistoryScreen   from './screens/HistoryScreen';
import WorkoutScreen   from './screens/WorkoutScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import MeasureScreen   from './screens/MeasureScreen';
import MuscleMapScreen from './screens/MuscleMapScreen';

// Mock data
import {
  mockUser,
  mockChartData,
  mockSessions,
  mockTemplates,
  mockExercises,
  mockPrimaryMetrics,
  mockBodyPartMetrics,
} from './data/mockData';

const Tab = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const STORAGE_KEY = 'strongern_app_data_v1';
  const CLOUD_PREFIX = 'strongern_cloud_backup_v1_';

  // Dynamic States
  const [user, setUser] = React.useState(mockUser);
  const [sessionsList, setSessionsList] = React.useState(mockSessions);
  const [templatesList, setTemplatesList] = React.useState(mockTemplates);
  const [exercisesList, setExercisesList] = React.useState(mockExercises);
  const [primaryMetricsList, setPrimaryMetricsList] = React.useState(mockPrimaryMetrics);
  const [bodyPartMetricsList, setBodyPartMetricsList] = React.useState(mockBodyPartMetrics);
  const [isAutoTimerEnabled, setIsAutoTimerEnabled] = React.useState(true);
  const [googleUser, setGoogleUser] = React.useState<{ email: string; name: string } | null>(null);
  const [animationSpeed, setAnimationSpeed] = React.useState(1);

  // Dynamically calculate weekly chart data based on sessionsList
  const dynamicWeeklyChartData = React.useMemo(() => {
    const weeks: { start: Date; end: Date; label: string; count: number }[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    
    for (let i = 7; i >= 0; i--) {
      const start = new Date(Date.now() - i * 7 * oneDay);
      const day = start.getDay();
      start.setTime(start.getTime() - day * oneDay);
      start.setHours(0, 0, 0, 0);
      
      weeks.push({
        start,
        end: new Date(start.getTime() + 7 * oneDay - 1),
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: 0,
      });
    }
    
    sessionsList.forEach(session => {
      const sessDate = new Date(session.datetime);
      weeks.forEach(w => {
        if (sessDate >= w.start && sessDate <= w.end) {
          w.count++;
        }
      });
    });
    
    return weeks.map(w => ({ weekLabel: w.label, count: w.count }));
  }, [sessionsList]);

  // Load from local storage on mount
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.user) setUser(parsed.user);
          if (parsed.sessionsList) {
            setSessionsList(parsed.sessionsList.map((s: any) => ({
              ...s,
              datetime: new Date(s.datetime)
            })));
          }
          if (parsed.templatesList) {
            setTemplatesList(parsed.templatesList.map((t: any) => ({
              ...t,
              lastUsed: new Date(t.lastUsed)
            })));
          }
          if (parsed.exercisesList) setExercisesList(parsed.exercisesList);
          if (parsed.primaryMetricsList) setPrimaryMetricsList(parsed.primaryMetricsList);
          if (parsed.bodyPartMetricsList) setBodyPartMetricsList(parsed.bodyPartMetricsList);
          if (parsed.isAutoTimerEnabled !== undefined) setIsAutoTimerEnabled(parsed.isAutoTimerEnabled);
          if (parsed.googleUser !== undefined) setGoogleUser(parsed.googleUser);
          if (parsed.animationSpeed !== undefined) setAnimationSpeed(parsed.animationSpeed);
        }
      }
    } catch (e) {
      console.warn('Error loading persisted state', e);
    }
  }, []);

  // Save to local storage on state changes
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = {
          user: {
            ...user,
            totalWorkouts: sessionsList.length,
          },
          sessionsList,
          templatesList,
          exercisesList,
          primaryMetricsList,
          bodyPartMetricsList,
          isAutoTimerEnabled,
          googleUser,
          animationSpeed,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Error saving state to storage', e);
    }
  }, [user, sessionsList, templatesList, exercisesList, primaryMetricsList, bodyPartMetricsList, isAutoTimerEnabled, googleUser, animationSpeed]);

  // Google Sync & Simulated Cloud Backup logic
  const handleGoogleLogin = (email: string, name: string) => {
    setGoogleUser({ email, name });
    setUser(prev => ({ ...prev, name }));
    
    // Check if cloud backup exists and auto-restore it!
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const backupStr = window.localStorage.getItem(`${CLOUD_PREFIX}${email}`);
        if (backupStr) {
          const parsed = JSON.parse(backupStr);
          if (parsed.user) setUser(parsed.user);
          if (parsed.sessionsList) {
            setSessionsList(parsed.sessionsList.map((s: any) => ({
              ...s,
              datetime: new Date(s.datetime)
            })));
          }
          if (parsed.templatesList) {
            setTemplatesList(parsed.templatesList.map((t: any) => ({
              ...t,
              lastUsed: new Date(t.lastUsed)
            })));
          }
          if (parsed.exercisesList) setExercisesList(parsed.exercisesList);
          if (parsed.primaryMetricsList) setPrimaryMetricsList(parsed.primaryMetricsList);
          if (parsed.bodyPartMetricsList) setBodyPartMetricsList(parsed.bodyPartMetricsList);
          return true; // Data loaded
        }
      }
    } catch (e) {
      console.warn('Error auto-restoring backup', e);
    }
    return false;
  };

  const handleGoogleLogout = () => {
    setGoogleUser(null);
  };

  const handleCloudSync = () => {
    if (!googleUser) return false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = {
          user,
          sessionsList,
          templatesList,
          exercisesList,
          primaryMetricsList,
          bodyPartMetricsList,
          isAutoTimerEnabled,
          timestamp: new Date().toISOString(),
        };
        window.localStorage.setItem(`${CLOUD_PREFIX}${googleUser.email}`, JSON.stringify(data));
        return true;
      }
    } catch (e) {
      console.warn('Error saving cloud backup', e);
    }
    return false;
  };

  // Export/Import backups
  const handleExportBackup = (): string => {
    const data = {
      user,
      sessionsList,
      templatesList,
      exercisesList,
      primaryMetricsList,
      bodyPartMetricsList,
      isAutoTimerEnabled,
      exportTimestamp: new Date().toISOString(),
    };
    return JSON.stringify(data);
  };

  const handleImportBackup = (backupStr: string): boolean => {
    try {
      const parsed = JSON.parse(backupStr);
      if (parsed.user) setUser(parsed.user);
      if (parsed.sessionsList) {
        setSessionsList(parsed.sessionsList.map((s: any) => ({
          ...s,
          datetime: new Date(s.datetime)
        })));
      }
      if (parsed.templatesList) {
        setTemplatesList(parsed.templatesList.map((t: any) => ({
          ...t,
          lastUsed: new Date(t.lastUsed)
        })));
      }
      if (parsed.exercisesList) setExercisesList(parsed.exercisesList);
      if (parsed.primaryMetricsList) setPrimaryMetricsList(parsed.primaryMetricsList);
      if (parsed.bodyPartMetricsList) setBodyPartMetricsList(parsed.bodyPartMetricsList);
      return true;
    } catch (e) {
      console.warn('Error importing backup', e);
      return false;
    }
  };

  const handleExportCSV = (): string => {
    let csv = 'Session ID,Date,Title,Duration (min),Volume (kg),PRs,Exercise Name,Sets,Best Weight (kg),Best Reps\n';
    sessionsList.forEach(session => {
      const dateStr = new Date(session.datetime).toISOString();
      session.exercises.forEach(ex => {
        const cleanTitle = session.title.replace(/"/g, '""');
        const cleanExName = ex.name.replace(/"/g, '""');
        csv += `"${session.id}","${dateStr}","${cleanTitle}",${session.durationMinutes},${session.totalVolumeKg},${session.prs},"${cleanExName}",${ex.sets},${ex.bestWeight},${ex.bestReps}\n`;
      });
    });
    return csv;
  };

  // Dynamic state modifiers
  const handleAddExercise = (name: string, muscleGroup: string) => {
    const newEx = {
      id: `ex-custom-${Date.now()}`,
      name,
      muscleGroup,
      weeklySets: 0,
    };
    setExercisesList(prev => [newEx, ...prev]);
  };

  const handleDeleteExercise = (id: string) => {
    setExercisesList(prev => prev.filter(e => e.id !== id));
  };

  const handleAddTemplate = (name: string, exerciseNames: string[]) => {
    const newTpl = {
      id: `tpl-custom-${Date.now()}`,
      name,
      exercises: exerciseNames,
      lastUsed: new Date(),
    };
    setTemplatesList(prev => [newTpl, ...prev]);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplatesList(prev => prev.filter(t => t.id !== id));
  };

  const handleUpdateTemplate = (id: string, name: string, exerciseNames: string[]) => {
    setTemplatesList(prev => prev.map(t => t.id === id ? { ...t, name, exercises: exerciseNames } : t));
  };

  const handleRecordMetric = (id: string, newValue: string) => {
    setPrimaryMetricsList(prev => prev.map(m => m.id === id ? { ...m, lastValue: newValue } : m));
    setBodyPartMetricsList(prev => prev.map(m => m.id === id ? { ...m, lastValue: newValue } : m));
  };

  const handleAddMetric = (label: string, isPrimary: boolean) => {
    const newMetric = {
      id: `metric-custom-${Date.now()}`,
      label,
      lastValue: undefined,
    };
    if (isPrimary) {
      setPrimaryMetricsList(prev => [...prev, newMetric]);
    } else {
      setBodyPartMetricsList(prev => [...prev, newMetric]);
    }
  };

  const handleUpdateUser = (name: string) => {
    setUser(prev => ({ ...prev, name }));
  };

  const handleWipeAllData = () => {
    setUser({
      name: 'Alex Morgan',
      totalWorkouts: 0,
      isPro: false,
    });
    setSessionsList([]);
    setTemplatesList([]);
    setGoogleUser(null);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Measure modal state (accessed from Profile)
  const [isMeasureModalVisible, setIsMeasureModalVisible] = React.useState(false);

  // Compute weekly muscle sets from sessions in the last 7 days
  const weeklyMuscleSets = React.useMemo(() => {
    const exerciseMuscleMap: Record<string, string> = {};
    exercisesList.forEach(ex => {
      exerciseMuscleMap[ex.name.toLowerCase()] = ex.muscleGroup;
    });
    const nameToMuscle = (name: string): string => {
      const n = name.toLowerCase();
      if (n.includes('squat') || n.includes('leg press') || n.includes('quad')) return 'Quads';
      if (n.includes('deadlift') || n.includes('row') || n.includes('pull') || n.includes('lat')) return 'Back';
      if (n.includes('bench') || n.includes('fly') || n.includes('chest') || n.includes('pec')) return 'Chest';
      if (n.includes('press') && (n.includes('overhead') || n.includes('shoulder') || n.includes('military'))) return 'Shoulders';
      if (n.includes('curl') || n.includes('bicep')) return 'Biceps';
      if (n.includes('tricep') || n.includes('pushdown') || n.includes('dip') || n.includes('skull')) return 'Triceps';
      if (n.includes('hamstring') || n.includes('nordic') || n.includes('leg curl') || n.includes('romanian')) return 'Hamstrings';
      if (n.includes('glute') || n.includes('hip thrust')) return 'Glutes';
      if (n.includes('lateral raise') || n.includes('rear delt') || n.includes('face pull')) return 'Rear Delts';
      if (n.includes('calf')) return 'Calves';
      return exerciseMuscleMap[n] ?? 'Other';
    };
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sets: Record<string, number> = {};
    sessionsList.forEach(session => {
      if (new Date(session.datetime) < cutoff) return;
      session.exercises.forEach(ex => {
        const muscle = nameToMuscle(ex.name);
        sets[muscle] = (sets[muscle] ?? 0) + ex.sets;
      });
    });
    return sets;
  }, [sessionsList, exercisesList]);

  // Active workout management states
  const [isWorkoutActive, setIsWorkoutActive] = React.useState(true);
  const [workoutName, setWorkoutName] = React.useState("Upper Body Power");
  const [startTime, setStartTime] = React.useState(() => new Date(Date.now() - 23 * 60 * 1000));
  const [workoutExercises, setWorkoutExercises] = React.useState<any[]>(() => mockSessions[0].exercises);
  const [isWorkoutModalVisible, setIsWorkoutModalVisible] = React.useState(false);
  const [completionData, setCompletionData] = React.useState<{
    totalVolume: number;
    totalSets: number;
    durationMin: number;
    name: string;
  } | null>(null);

  const handleStartWorkout = (name: string, exerciseNames: string[]) => {
    setWorkoutName(name);
    setStartTime(new Date());
    
    // Map exercise names to exercise set objects
    const mappedExercises = exerciseNames.map(exName => {
      let bestWeight = 60;
      let bestReps = 10;
      let sets = 3;

      const previousSession = sessionsList.find(s => 
        s.exercises.some(e => e.name.toLowerCase() === exName.toLowerCase())
      );
      if (previousSession) {
        const found = previousSession.exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
        if (found) {
          bestWeight = found.bestWeight;
          bestReps = found.bestReps;
          sets = found.sets;
        }
      }
      
      return {
        name: exName,
        sets,
        bestWeight,
        bestReps,
      };
    });

    setWorkoutExercises(mappedExercises.length > 0 ? mappedExercises : [
      { name: 'Bench Press', sets: 3, bestWeight: 60, bestReps: 10 }
    ]);
    setIsWorkoutActive(true);
    setIsWorkoutModalVisible(true);
  };

  const handleFinishWorkout = (summary: { totalVolume: number; totalSets: number; durationMin: number }) => {
    const newSession = {
      id: `session-new-${Date.now()}`,
      title: workoutName,
      datetime: new Date(),
      comment: 'Logged via live active tracker!',
      exercises: workoutExercises,
      durationMinutes: summary.durationMin,
      totalVolumeKg: summary.totalVolume,
      prs: summary.totalVolume > 0 ? 1 : 0,
    };

    setSessionsList(prev => [newSession, ...prev]);
    
    // Show celebratory screen
    setCompletionData({
      totalVolume: summary.totalVolume,
      totalSets: summary.totalSets,
      durationMin: summary.durationMin,
      name: workoutName,
    });

    setIsWorkoutActive(false);
    setIsWorkoutModalVisible(false);

    // Auto backup if google connected
    if (googleUser) {
      setTimeout(() => {
        const backupData = {
          user: {
            ...user,
            totalWorkouts: sessionsList.length + 1,
          },
          sessionsList: [newSession, ...sessionsList],
          templatesList,
          exercisesList,
          primaryMetricsList,
          bodyPartMetricsList,
          isAutoTimerEnabled,
          timestamp: new Date().toISOString(),
        };
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(`${CLOUD_PREFIX}${googleUser.email}`, JSON.stringify(backupData));
          }
        } catch (e) {
          console.warn('Auto sync failed', e);
        }
      }, 500);
    }
  };

  const handleDiscardWorkout = () => {
    setIsWorkoutActive(false);
    setIsWorkoutModalVisible(false);
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <View style={styles.root}>
          <Tab.Navigator
            tabBar={props => (
              <>
                {isWorkoutActive && (
                  <ActiveWorkoutBar
                    workoutName={workoutName}
                    startTime={startTime}
                    onPress={() => setIsWorkoutModalVisible(true)}
                    onFinish={() => setIsWorkoutModalVisible(true)}
                  />
                )}
                <BottomTabBar {...props} />
              </>
            )}
            screenOptions={{ headerShown: false }}
          >
            <Tab.Screen name="Profile">
              {() => (
                <ProfileScreen
                  user={{
                    ...user,
                    totalWorkouts: sessionsList.length,
                  }}
                  weeklyChartData={dynamicWeeklyChartData}
                  sessions={sessionsList}
                  isAutoTimerEnabled={isAutoTimerEnabled}
                  setIsAutoTimerEnabled={setIsAutoTimerEnabled}
                  onMeasurePress={() => setIsMeasureModalVisible(true)}
                  googleUser={googleUser}
                  onGoogleLogin={handleGoogleLogin}
                  onGoogleLogout={handleGoogleLogout}
                  onCloudSync={handleCloudSync}
                  onUpdateUser={handleUpdateUser}
                  onImportBackup={handleImportBackup}
                  onExportBackup={handleExportBackup}
                  onExportCSV={handleExportCSV}
                  animationSpeed={animationSpeed}
                  setAnimationSpeed={setAnimationSpeed}
                  onWipeAllData={handleWipeAllData}
                />
              )}
            </Tab.Screen>

            <Tab.Screen name="History">
              {() => <HistoryScreen sessions={sessionsList} />}
            </Tab.Screen>

            <Tab.Screen name="Workout">
              {() => (
                <WorkoutScreen 
                  templates={templatesList} 
                  onStartWorkout={handleStartWorkout}
                  onAddTemplate={handleAddTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onUpdateTemplate={handleUpdateTemplate}
                  exercises={exercisesList}
                />
              )}
            </Tab.Screen>

            <Tab.Screen name="Exercises">
              {() => (
                <ExercisesScreen 
                  exercises={exercisesList} 
                  onAddExercise={handleAddExercise}
                  onDeleteExercise={handleDeleteExercise}
                />
              )}
            </Tab.Screen>

            <Tab.Screen name="Muscles">
              {() => (
                <MuscleMapScreen
                  weeklyMuscleSets={weeklyMuscleSets}
                />
              )}
            </Tab.Screen>
          </Tab.Navigator>

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
          />

          {/* Measure Modal Sheet (accessible from Profile) */}
          <Modal
            visible={isMeasureModalVisible}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setIsMeasureModalVisible(false)}
          >
            <View style={styles.measureModalContainer}>
              <View style={styles.measureModalHeader}>
                <Pressable
                  onPress={() => setIsMeasureModalVisible(false)}
                  style={styles.measureModalClose}
                  android_ripple={rippleTokens.borderless}
                  accessibilityLabel="Close measurements"
                >
                  <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
                </Pressable>
              </View>
              <MeasureScreen
                primaryMetrics={primaryMetricsList}
                bodyPartMetrics={bodyPartMetricsList}
                onRecordMetric={handleRecordMetric}
                onAddMetric={handleAddMetric}
              />
            </View>
          </Modal>

          {/* Premium Congratulations Modal Overlay */}
          {completionData && (
            <Modal transparent visible={!!completionData} animationType="fade">
              <View style={styles.celebrationBackdrop}>
                <View style={styles.celebrationCard}>
                  <View style={[styles.trophyGlow, { backgroundColor: colors.gold + '1A' }]}>
                    <Ionicons name="trophy" size={54} color={colors.gold} />
                  </View>
                  
                  <Text style={styles.celebrationTitle}>WORKOUT COMPLETED!</Text>
                  <Text style={styles.celebrationSubtitle}>{completionData.name}</Text>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.celebrationStats}>
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.durationMin}m</Text>
                      <Text style={styles.statLabel}>DURATION</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.totalSets}</Text>
                      <Text style={styles.statLabel}>SETS</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.celebrationStatItem}>
                      <Text style={styles.statVal}>{completionData.totalVolume} kg</Text>
                      <Text style={styles.statLabel}>VOLUME</Text>
                    </View>
                  </View>
                  
                  <Pressable
                    style={styles.doneBtn}
                    onPress={() => setCompletionData(null)}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.doneBtnText}>AWESOME</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex:            1,
    backgroundColor: colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Celebration Modal Styles
  celebrationBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(5, 7, 10, 0.92)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         24,
  },
  celebrationCard: {
    width:           '90%',
    maxWidth:        340,
    backgroundColor: colors.surface,
    borderColor:     colors.border,
    borderWidth:     1,
    borderRadius:    radius.lg,
    padding:         24,
    alignItems:      'center',
    ...(shadow.lg as object),
  },
  trophyGlow: {
    width:           90,
    height:          90,
    borderRadius:    45,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  celebrationTitle: {
    color:         colors.gold,
    fontSize:      font.sizes.lg,
    fontFamily:    font.bold,
    letterSpacing: 1.5,
    textAlign:     'center',
  },
  celebrationSubtitle: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
    marginTop:  4,
    textAlign:  'center',
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    width:           '100%',
    marginVertical:  20,
  },
  celebrationStats: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-around',
    width:          '100%',
    marginBottom:   24,
  },
  celebrationStatItem: {
    alignItems: 'center',
    flex:       1,
  },
  statVal: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.bold,
  },
  statLabel: {
    color:         colors.textSecondary,
    fontSize:      font.sizes.xs,
    fontFamily:    font.semibold,
    marginTop:     4,
    letterSpacing: 0.5,
  },
  statDivider: {
    width:           1,
    height:          30,
    backgroundColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    width:           '100%',
    paddingVertical: 12,
    borderRadius:    radius.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  doneBtnText: {
    color:         colors.textInverse,
    fontSize:      font.sizes.sm,
    fontFamily:    font.bold,
    letterSpacing: 1,
  },

  // Measure Modal
  measureModalContainer: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  measureModalHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.surface,
  },
  measureModalClose: {
    padding: spacing.xs,
  },
});
