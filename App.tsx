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

  // Measure modal state (accessed from Profile)
  const [isMeasureModalVisible, setIsMeasureModalVisible] = React.useState(false);

  // Compute weekly muscle sets from sessions in the last 7 days
  const weeklyMuscleSets = React.useMemo(() => {
    // Exercise name -> muscle group mapping from mockExercises
    const exerciseMuscleMap: Record<string, string> = {};
    mockExercises.forEach(ex => {
      exerciseMuscleMap[ex.name.toLowerCase()] = ex.muscleGroup;
    });
    // Simple heuristic for exercises not in the list
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
    mockSessions.forEach(session => {
      if (new Date(session.datetime) < cutoff) return;
      session.exercises.forEach(ex => {
        const muscle = nameToMuscle(ex.name);
        sets[muscle] = (sets[muscle] ?? 0) + ex.sets;
      });
    });
    return sets;
  }, []);

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

  // History list state to dynamically include completed sessions!
  const [sessionsList, setSessionsList] = React.useState(() => mockSessions);

  // Global Rest Timer settings
  const [isAutoTimerEnabled, setIsAutoTimerEnabled] = React.useState(true);

  const handleStartWorkout = (name: string, exerciseNames: string[]) => {
    setWorkoutName(name);
    setStartTime(new Date());
    
    // Map exercise names to exercise set objects
    const mappedExercises = exerciseNames.map(exName => {
      let bestWeight = 60;
      let bestReps = 10;
      let sets = 3;

      const previousSession = mockSessions.find(s => 
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
    // Save to local sessions history state!
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
                  user={mockUser}
                  weeklyChartData={mockChartData}
                  isAutoTimerEnabled={isAutoTimerEnabled}
                  setIsAutoTimerEnabled={setIsAutoTimerEnabled}
                  onMeasurePress={() => setIsMeasureModalVisible(true)}
                />
              )}
            </Tab.Screen>

            <Tab.Screen name="History">
              {() => <HistoryScreen sessions={sessionsList} />}
            </Tab.Screen>

            <Tab.Screen name="Workout">
              {() => (
                <WorkoutScreen 
                  templates={mockTemplates} 
                  onStartWorkout={handleStartWorkout}
                />
              )}
            </Tab.Screen>

            <Tab.Screen name="Exercises">
              {() => <ExercisesScreen exercises={mockExercises} />}
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
                primaryMetrics={mockPrimaryMetrics}
                bodyPartMetrics={mockBodyPartMetrics}
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
