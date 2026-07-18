import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  Platform,
  Alert,
  Image,
} from 'react-native';

const WebSafeAlert = {
  alert: (title: string, message?: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }
};
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, shadow, ripple } from '../theme';
import { Exercise, WorkoutSession, mockExerciseHistory } from '../data/mockData';
import SegmentedControl from '../components/ui/SegmentedControl';
import Card from '../components/ui/Card';
import LineChart from '../components/ui/charts/LineChart';
import DistributionChart from '../components/ui/charts/DistributionChart';
import { exercise1RMSeries, estimate1RM } from '../utils/strength';
import {
  setsPerWeek,
  avgRepsPerWorkout,
} from '../utils/exerciseStats';

class TabErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ExerciseInsightsModal TabErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={{ color: colors.textPrimary, fontFamily: font.bold, fontSize: font.sizes.base, marginTop: spacing.md }}>
            Unable to load chart data
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: font.regular, fontSize: font.sizes.sm, textAlign: 'center', marginTop: spacing.xs }}>
            An error occurred while rendering performance insights. Your workout is safe.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Helper functions for normal distribution percentile estimation
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

function getExercisePercentile(name: string, weight: number): number {
  if (weight <= 0) return 0.5;
  const exerciseNameClean = name.toLowerCase().trim();
  let mean = 70;
  let sd = 15;
  if (exerciseNameClean.includes('bench press')) {
    mean = 75;
    sd = 15;
  } else if (exerciseNameClean.includes('squat')) {
    mean = 95;
    sd = 20;
  } else if (exerciseNameClean.includes('overhead press') || exerciseNameClean.includes('ohp')) {
    mean = 50;
    sd = 10;
  } else if (exerciseNameClean.includes('pull-up') || exerciseNameClean.includes('pull up')) {
    mean = 85;
    sd = 15;
  } else if (exerciseNameClean.includes('curl')) {
    mean = 16;
    sd = 4;
  } else if (exerciseNameClean.includes('dip')) {
    mean = 90;
    sd = 18;
  }
  const z = (weight - mean) / sd;
  return Math.min(0.99, Math.max(0.01, normalCDF(z)));
}

export interface ExerciseInsightsModalProps {
  visible: boolean;
  exerciseName: string;
  exerciseLibraryEntry?: Exercise;
  sessions: WorkoutSession[];
  onClose: () => void;
  onUpdateExerciseInsightsNotes?: (id: string, insightsNotes?: string) => void;
}

const ExerciseInsightsModal: React.FC<ExerciseInsightsModalProps> = ({
  visible,
  exerciseName,
  exerciseLibraryEntry,
  sessions,
  onClose,
  onUpdateExerciseInsightsNotes,
}) => {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'info' | 'data' | 'history'>('info');
  const [notes, setNotes] = useState(exerciseLibraryEntry?.insightsNotes || '');
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const toggleSessionExpand = useCallback((sessionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  }, []);

  const strengthPercentile = useMemo(() => {
    const series1RM = exercise1RMSeries(exerciseName, sessions);
    const current1RM = series1RM.length > 0 ? series1RM[series1RM.length - 1].value : 0;
    return getExercisePercentile(exerciseName, current1RM);
  }, [exerciseName, sessions]);

  // Sync state if exercise or insightsNotes prop changes
  useEffect(() => {
    setNotes(exerciseLibraryEntry?.insightsNotes || '');
  }, [exerciseLibraryEntry]);

  // Tab definitions
  const tabs = [
    { key: 'info', label: 'Info', icon: 'information-circle-outline' },
    { key: 'data', label: 'Data', icon: 'analytics-outline' },
    { key: 'history', label: 'History', icon: 'time-outline' },
  ];

  // Chart datasets (Data Tab)
  const chartData = useMemo(() => {
    // 1RM series: Map dates to timestamps for line chart x-axis
    const series1RM = exercise1RMSeries(exerciseName, sessions).map((pt) => ({
      x: pt.date.getTime(),
      y: pt.value,
      label: pt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));

    // Sets per week series: Map weekStart date to timestamp
    const weeklySetsSeries = setsPerWeek(exerciseName, sessions).map((pt) => ({
      x: pt.weekStart.getTime(),
      y: pt.count,
      label: pt.weekStart.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }),
    }));

    // Average reps series
    const repsSeries = avgRepsPerWorkout(exerciseName, sessions).map((pt) => ({
      x: pt.date.getTime(),
      y: pt.avg,
      label: pt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));

    return {
      series1RM,
      weeklySetsSeries,
      repsSeries,
    };
  }, [exerciseName, sessions]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  }, [onClose]);

  const handleAutoSaveNotes = useCallback(() => {
    if (!exerciseLibraryEntry?.id) return;
    if (onUpdateExerciseInsightsNotes) {
      onUpdateExerciseInsightsNotes(exerciseLibraryEntry.id, notes);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSavedJustNow(true);
  }, [notes, exerciseLibraryEntry, onUpdateExerciseInsightsNotes]);

  // Fade out saved toast after 1.5s
  useEffect(() => {
    if (savedJustNow) {
      const timer = setTimeout(() => {
        setSavedJustNow(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [savedJustNow]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            onPress={handleClose}
            testID="insights-back-btn"
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {exerciseName.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Segmented Control Tab Bar */}
        <View style={styles.tabsWrapper}>
          <SegmentedControl tabs={tabs} activeKey={activeTab} onChange={(k) => setActiveTab(k as any)} />
        </View>

        {/* Tab Scroll Content */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TabErrorBoundary key={activeTab}>
            {activeTab === 'info' && (
              <View style={styles.tabContent}>
              {/* Image placeholder / barbell icon */}
              <View style={styles.imagePlaceholder}>
                {exerciseLibraryEntry?.imageUri ? (
                  <Image
                    source={{ uri: exerciseLibraryEntry.imageUri }}
                    style={styles.exerciseImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noImageContainer}>
                    <Ionicons name="barbell" size={36} color={colors.textMuted} />
                    <Text style={styles.noImageText}>No image</Text>
                  </View>
                )}
              </View>

              {/* Instructions card */}
              <Card padding={spacing.md} style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>Instructions</Text>
                <Text style={styles.instructionsText}>
                  {exerciseLibraryEntry?.instructions || 'No instructions provided.'}
                </Text>
              </Card>

              {/* Body Part + Category labels */}
              <View style={styles.pillsRow}>
                <View style={styles.pillCard}>
                  <Text style={styles.pillLabel}>BODY PART</Text>
                  <Text style={styles.pillValue}>
                    {exerciseLibraryEntry?.muscleGroup?.toUpperCase() || 'N/A'}
                  </Text>
                </View>
                <View style={styles.pillCard}>
                  <Text style={styles.pillLabel}>CATEGORY</Text>
                  <Text style={styles.pillValue}>
                    {exerciseLibraryEntry?.equipment?.toUpperCase() || 'GENERAL'}
                  </Text>
                </View>
              </View>

              {/* Inline Notes Editor */}
              {exerciseLibraryEntry && (
                <Card padding={spacing.lg} style={styles.notesContainer}>
                  <View style={styles.notesHeader}>
                    <Text style={styles.sectionTitle}>Exercise Insights Notes</Text>
                    {savedJustNow && (
                      <Text style={styles.savedToast}>Saved</Text>
                    )}
                  </View>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    onEndEditing={handleAutoSaveNotes}
                    onBlur={handleAutoSaveNotes}
                    placeholder="Enter training notes, setup details, seat height, etc..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    testID="insights-notes-input"
                  />
                </Card>
              )}
            </View>
          )}

          {activeTab === 'data' && (
            <View style={styles.tabContent}>
              {/* Distribution Chart */}
              <View style={styles.chartWrapper}>
                <DistributionChart
                  title="Estimated 1RM Strength Distribution"
                  percentile={strengthPercentile}
                />
              </View>

              {/* Charts Section */}
              <View style={styles.chartWrapper}>
                <LineChart
                  title="Estimated 1RM over Time (kg)"
                  data={chartData.series1RM}
                  color={colors.accent}
                  height={150}
                  yAxisFormatter={(val) => `${Math.round(val)}kg`}
                />
              </View>

              <View style={styles.chartWrapper}>
                <LineChart
                  title="Sets Completed Per Week"
                  data={chartData.weeklySetsSeries}
                  color={colors.accent}
                  height={150}
                  yAxisFormatter={(val) => `${Math.round(val)} sets`}
                />
              </View>

              <View style={styles.chartWrapper}>
                <LineChart
                  title="Average Reps Per Workout"
                  data={chartData.repsSeries}
                  color={colors.highlight}
                  height={150}
                  yAxisFormatter={(val) => `${Math.round(val * 10) / 10}`}
                />
              </View>
            </View>
          )}

          {activeTab === 'history' && (
            <View style={styles.tabContent}>
              {(() => {
                const history = (mockExerciseHistory || []).filter(
                  (h) => h && h.exerciseId === exerciseLibraryEntry?.id && Array.isArray(h.sets) && h.sets.length > 0
                );

                if (history.length === 0) {
                  return (
                    <View style={styles.emptyHistoryContainer}>
                      <Ionicons name="time-outline" size={48} color={colors.textMuted} />
                      <Text style={styles.emptyHistoryText}>
                        No training history found for this exercise.
                      </Text>
                    </View>
                  );
                }

                // Sort history by date descending
                const validHistory = history.filter((h) => h && h.date && !isNaN(new Date(h.date).getTime()));
                const sortedHistory = [...validHistory].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                return (
                  <View style={styles.historyList}>
                    {sortedHistory.map((entry, idx) => {
                      const sets = entry.sets || [];
                      let bestSet = sets[0] || { weightKg: 0, reps: 0 };
                      let bestSet1RM = 0;
                      sets.forEach((s) => {
                        if (!s) return;
                        const s1RM = estimate1RM(s.weightKg, s.reps);
                        if (!isNaN(s1RM) && s1RM >= bestSet1RM) {
                          bestSet1RM = s1RM;
                          bestSet = s;
                        }
                      });

                      const sessionEst1RM = Math.max(0, bestSet1RM);
                      const isExpanded = !!expandedSessions[entry.id];

                      const day = String(entry.date.getDate()).padStart(2, '0');
                      const month = String(entry.date.getMonth() + 1).padStart(2, '0');
                      const year = entry.date.getFullYear();
                      const dateString = `${day}.${month}.${year}`;

                      const chevronElement = (
                        <View style={styles.bottomChevronContainer}>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color={colors.textMuted}
                          />
                        </View>
                      );

                      return (
                        <Card
                          key={entry.id}
                          padding={0}
                          style={styles.historyCard}
                        >
                          <Pressable
                            onPress={() => toggleSessionExpand(entry.id)}
                            android_ripple={ripple.surface}
                            style={({ pressed }) => [
                              styles.cardPressable,
                              pressed && Platform.OS === 'ios' && { opacity: 0.7 }
                            ]}
                          >
                            <View style={styles.metricsContainerCompact}>
                              <View style={[styles.metricColumnLeft, { alignItems: 'center' }]}>
                                <Text style={styles.metricLabel}>BEST SET</Text>
                                <Text style={styles.metricValue}>
                                  {bestSet.weightKg}kg × {bestSet.reps}
                                </Text>
                              </View>
                              <View style={[styles.metricColumnCenter, { alignItems: 'center' }]}>
                                <Text style={styles.metricLabel}>DATE</Text>
                                <Text style={styles.dateTextLargePrimary}>{dateString}</Text>
                              </View>
                              <View style={[styles.metricColumnRight, { alignItems: 'center' }]}>
                                <Text style={styles.metricLabel}>EST. 1RM</Text>
                                <Text style={styles.metricValue}>
                                  {Math.round(sessionEst1RM)}kg
                                </Text>
                              </View>
                            </View>
                            {chevronElement}

                            {/* Expanded set list details */}
                            {isExpanded && (
                              <View style={styles.expandedContainer}>
                                <View style={styles.expandedSetsList}>
                                  {entry.sets.map((set, setIdx) => {
                                    return (
                                      <View key={setIdx} style={styles.expandedSetRow}>
                                        <Text style={styles.expandedSetIndexText}>
                                          {setIdx + 1}
                                        </Text>
                                        <Text style={styles.expandedSetDetailsText}>
                                          <Text style={styles.expandedSetValueText}>{set.reps}</Text>
                                          <Text style={styles.expandedSetUnitText}> reps</Text>
                                          <Text style={styles.expandedSetTimesText}>  ×  </Text>
                                          <Text style={styles.expandedSetValueText}>{set.weightKg}</Text>
                                          <Text style={styles.expandedSetUnitText}> kg</Text>
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            )}
                          </Pressable>
                        </Card>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          )}
          </TabErrorBoundary>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    letterSpacing: -0.5,
  },
  tabsWrapper: {
    paddingHorizontal: 24,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: spacing.xxl,
  },
  tabContent: {
    marginTop: spacing.sm,
  },
  imagePlaceholder: {
    height: 160,
    width: '100%',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: font.sizes.xs,
    marginTop: spacing.xs,
  },
  instructionsCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  instructionsTitle: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
    marginBottom: spacing.xs,
  },
  instructionsText: {
    color: colors.textSecondary,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    lineHeight: 20,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  pillCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontSize: font.sizes.xs - 1,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pillValue: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
  },
  notesContainer: {
    backgroundColor: colors.surface,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.md,
    marginBottom: 0,
  },
  savedToast: {
    color: colors.success,
    fontFamily: font.semibold,
    fontSize: font.sizes.xs,
  },
  notesInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    padding: spacing.md,
    height: 72,
    marginBottom: 0,
  },
  chartWrapper: {
    marginTop: spacing.md,
  },
  historyList: {
    gap: spacing.xs,
  },
  historyCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  cardPressable: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderDate: {
    color: colors.textSecondary,
    fontFamily: font.semibold,
    fontSize: font.sizes.sm,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  metricColumnLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  metricColumnRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontSize: font.sizes.xs - 1,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.base,
  },
  metricValueAccent: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: font.sizes.base,
  },
  metricSub: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: font.sizes.xs,
    marginTop: 2,
  },
  deltaText: {
    fontFamily: font.semibold,
    fontSize: font.sizes.xs - 1,
    marginTop: 1,
  },
  expandedContainer: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  expandedSetsList: {
    gap: spacing.xs,
  },
  expandedSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  expandedSetIndexText: {
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontSize: font.sizes.xs,
    width: 24,
  },
  expandedSetDetailsText: {
    fontSize: font.sizes.sm,
  },
  expandedSetValueText: {
    color: colors.textPrimary,
    fontFamily: font.bold,
  },
  expandedSetUnitText: {
    color: colors.textSecondary,
    fontFamily: font.medium,
  },
  expandedSetTimesText: {
    color: colors.textMuted,
    fontFamily: font.regular,
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyHistoryText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  bottomChevronContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingBottom: 0,
  },
  previewControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewArrow: {
    padding: spacing.xs,
    backgroundColor: colors.surface2,
    borderRadius: radius.xs,
  },
  previewLabel: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.sm,
  },
  metricsContainerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 0,
  },
  metricColumnCenter: {
    flex: 1,
    alignItems: 'center',
  },
  dateTextLargePrimary: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.base,
  },
  dateTextLargeHighlight: {
    color: colors.highlight,
    fontFamily: font.bold,
    fontSize: font.sizes.base,
  },
  dateTextLargeMuted: {
    color: colors.textSecondary,
    fontFamily: font.bold,
    fontSize: font.sizes.base,
  },
  centeredDateBadgeCompact: {
    backgroundColor: colors.surface2,
    borderRadius: radius.xs,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  metricLabelBelow: {
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontSize: font.sizes.xs - 2,
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

export default ExerciseInsightsModal;
