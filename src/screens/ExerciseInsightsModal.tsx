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

  useEffect(() => {
    setNotes(exerciseLibraryEntry?.insightsNotes || '');
  }, [exerciseLibraryEntry]);

  const tabs = [
    { key: 'info', label: 'Info', icon: 'information-circle-outline' },
    { key: 'data', label: 'Data', icon: 'analytics-outline' },
    { key: 'history', label: 'History', icon: 'time-outline' },
  ];

  const chartData = useMemo(() => {
    const rawSeries1RM = exercise1RMSeries(exerciseName, sessions).map((pt) => ({
      x: pt.date.getTime(),
      y: pt.value,
      label: pt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));

    // 6-dot time-bucket sampling for line chart
    const sampleTopDots = (rawPoints: { x: number; y: number; label: string }[], maxDots = 6) => {
      if (rawPoints.length <= maxDots) return rawPoints;

      const minX = rawPoints[0].x;
      const maxX = rawPoints[rawPoints.length - 1].x;
      const timeSpan = maxX - minX;

      if (timeSpan <= 0) return rawPoints.slice(-maxDots);

      const bucketSize = timeSpan / maxDots;
      const sampled: { x: number; y: number; label: string }[] = [];

      for (let i = 0; i < maxDots; i++) {
        const bucketStart = minX + i * bucketSize;
        const bucketEnd = i === maxDots - 1 ? maxX + 1 : bucketStart + bucketSize;

        const pointsInBucket = rawPoints.filter((pt) => pt.x >= bucketStart && pt.x < bucketEnd);
        if (pointsInBucket.length > 0) {
          let best = pointsInBucket[0];
          for (const pt of pointsInBucket) {
            if (pt.y > best.y) {
              best = pt;
            }
          }
          sampled.push(best);
        }
      }

      const lastPoint = rawPoints[rawPoints.length - 1];
      if (!sampled.some((pt) => pt.x === lastPoint.x)) {
        if (sampled.length >= maxDots) {
          sampled.pop();
        }
        sampled.push(lastPoint);
      }

      return sampled;
    };

    const series1RM = sampleTopDots(rawSeries1RM, 6);

    const weeklySetsSeries = setsPerWeek(exerciseName, sessions).map((pt) => ({
      x: pt.weekStart.getTime(),
      y: pt.count,
      label: pt.weekStart.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }),
    }));

    const repsSeries = avgRepsPerWorkout(exerciseName, sessions).map((pt) => ({
      x: pt.date.getTime(),
      y: pt.avg,
      label: pt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));

    return {
      has1RMData: rawSeries1RM.length > 0 && rawSeries1RM.some((pt) => pt.y > 0),
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
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2000);
    }
  }, [exerciseLibraryEntry, notes, onUpdateExerciseInsightsNotes]);

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
            onPress={handleClose}
            style={styles.closeButton}
            android_ripple={ripple.borderless}
            testID="insights-back-btn"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {exerciseName}
            </Text>
            {exerciseLibraryEntry?.bodyPart && (
              <Text style={styles.headerSubtitle}>
                {exerciseLibraryEntry.bodyPart.toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ width: 40 }} />
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
                    </View>
                  )}
                </View>

                {exerciseLibraryEntry?.instructions && exerciseLibraryEntry.instructions.length > 0 && (
                  <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>INSTRUCTIONS</Text>
                    {exerciseLibraryEntry.instructions.map((step, idx) => (
                      <View key={idx} style={styles.instructionStep}>
                        <View style={styles.stepBadge}>
                          <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{step}</Text>
                      </View>
                    ))}
                  </Card>
                )}

                {exerciseLibraryEntry?.id && (
                  <Card style={styles.sectionCard}>
                    <View style={styles.notesHeader}>
                      <Text style={styles.sectionTitle}>EXERCISE INSIGHTS NOTES</Text>
                      {savedJustNow && (
                        <Text style={styles.savedBadgeText}>Saved</Text>
                      )}
                    </View>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      onBlur={handleAutoSaveNotes}
                      placeholder="Add personal cues, seat settings, or notes for this exercise..."
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
                {chartData.has1RMData && (
                  <View style={styles.chartWrapper}>
                    <DistributionChart
                      title="Estimated 1RM Strength Distribution"
                      percentile={strengthPercentile}
                    />
                  </View>
                )}

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
                  const historyFromSessions = (sessions || []).reduce<any[]>((acc, session) => {
                    if (!session || !session.exercises) return acc;
                    const ex = session.exercises.find((e: any) => 
                      (e.name && e.name.toLowerCase() === exerciseName.toLowerCase()) ||
                      (e.id && exerciseLibraryEntry?.id && e.id === exerciseLibraryEntry.id)
                    );
                    if (ex) {
                      const rawSets = ex.sets || ex.setsDetails || [];
                      const normalizedSets = rawSets.map((s: any) => ({
                        weightKg: Number(s.weightKg ?? s.weight ?? 0),
                        reps: Number(s.reps ?? 0),
                      })).filter((s: any) => s.reps > 0 || s.weightKg > 0);

                      if (normalizedSets.length > 0) {
                        const dt = session.datetime ? new Date(session.datetime) : (session.date ? new Date(session.date) : new Date());
                        acc.push({
                          id: session.id || `sess-${dt.getTime()}-${Math.random()}`,
                          date: dt,
                          sets: normalizedSets,
                        });
                      }
                    }
                    return acc;
                  }, []);

                  const historyFromMock = (mockExerciseHistory || [])
                    .filter((h) => h && h.exerciseId === exerciseLibraryEntry?.id && Array.isArray(h.sets) && h.sets.length > 0)
                    .map((h) => ({
                      id: h.id,
                      date: new Date(h.date),
                      sets: h.sets.map((s: any) => ({ weightKg: Number(s.weightKg ?? 0), reps: Number(s.reps ?? 0) })),
                    }));

                  const combinedHistoryMap = new Map<string, any>();
                  [...historyFromSessions, ...historyFromMock].forEach((item) => {
                    const timeKey = `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}`;
                    if (!combinedHistoryMap.has(timeKey)) {
                      combinedHistoryMap.set(timeKey, item);
                    }
                  });
                  const history = Array.from(combinedHistoryMap.values());

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
                        sets.forEach((s: any) => {
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

                              {isExpanded && (
                                <View style={styles.expandedContainer}>
                                  <View style={styles.expandedSetsList}>
                                    {entry.sets.map((set: any, setIdx: number) => {
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
  tabsWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  tabContent: {
    gap: spacing.lg,
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCard: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    color: colors.textPrimary,
  },
  instructionText: {
    flex: 1,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedBadgeText: {
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    color: colors.success,
  },
  notesInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartWrapper: {
    width: '100%',
  },
  emptyHistoryContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyHistoryText: {
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  historyList: {
    gap: spacing.md,
  },
  historyCard: {
    overflow: 'hidden',
  },
  cardPressable: {
    padding: spacing.md,
  },
  metricsContainerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricColumnLeft: {
    flex: 1,
  },
  metricColumnCenter: {
    flex: 1,
  },
  metricColumnRight: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: font.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    color: colors.textPrimary,
  },
  dateTextLargePrimary: {
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
    color: colors.textSecondary,
  },
  bottomChevronContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  expandedContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  expandedSetsList: {
    gap: spacing.xs,
  },
  expandedSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  expandedSetIndexText: {
    width: 24,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    color: colors.textMuted,
  },
  expandedSetDetailsText: {
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
  },
  expandedSetValueText: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
  },
  expandedSetUnitText: {
    color: colors.textSecondary,
  },
  expandedSetTimesText: {
    color: colors.textMuted,
  },
});

export default React.memo(ExerciseInsightsModal);
