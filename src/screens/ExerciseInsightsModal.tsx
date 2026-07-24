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

import i18n from '../utils/i18n';
import { getDisplayName, getMuscleDisplayName } from '../utils/exerciseNames';
import { addVariationToExercise, removeVariationFromExercise, isValidTag } from '../utils/variationUtils';

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

const getMuscleColor = (muscleGroup: string): string => {
  const group = (muscleGroup || '').toLowerCase();
  if (group.includes('chest')) return colors.muscle.chest;
  if (group.includes('back')) return colors.muscle.back;
  if (group.includes('quad')) return colors.muscle.quads;
  if (group.includes('hamstring')) return colors.muscle.hamstrings;
  if (group.includes('shoulder')) return colors.muscle.shoulders;
  if (group.includes('bicep')) return colors.muscle.biceps;
  if (group.includes('tricep')) return colors.muscle.triceps;
  if (group.includes('glute')) return colors.muscle.glutes;
  if (group.includes('rear')) return colors.muscle.rearDelts;
  if (group.includes('calv')) return colors.highlight;
  if (group.includes('core')) return colors.gold;
  if (group.includes('forearm')) return colors.muscle.biceps;
  return colors.muscle.default;
};

const getSecondaryMuscles = (primary: string): string => {
  const group = (primary || '').toLowerCase();
  if (group.includes('chest')) return 'Shoulders, Triceps';
  if (group.includes('back')) return 'Biceps, Rear Delts';
  if (group.includes('quad')) return 'Hamstrings, Glutes';
  if (group.includes('hamstring')) return 'Glutes, Calves';
  if (group.includes('shoulder')) return 'Triceps';
  if (group.includes('bicep')) return 'Forearms';
  if (group.includes('tricep')) return 'Shoulders';
  if (group.includes('glute')) return 'Hamstrings';
  if (group.includes('rear')) return 'Back';
  if (group.includes('calv')) return 'Hamstrings';
  if (group.includes('core')) return 'Lower Back';
  if (group.includes('forearm')) return 'Biceps, Wrist';
  return 'Core';
};

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
  onUpdateExerciseVariations?: (id: string, variations: string[]) => void;
  onDeleteExercise?: (id: string) => void;
  exerciseNameLanguage?: 'en' | 'he';
}

const ExerciseInsightsModal: React.FC<ExerciseInsightsModalProps> = ({
  visible,
  exerciseName,
  exerciseLibraryEntry,
  sessions,
  onClose,
  onUpdateExerciseInsightsNotes,
  onUpdateExerciseVariations,
  onDeleteExercise,
  exerciseNameLanguage = 'en',
}) => {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'info' | 'data' | 'history'>('info');
  const [notes, setNotes] = useState(exerciseLibraryEntry?.insightsNotes || '');
  const [newTagText, setNewTagText] = useState('');
  const [currentExercise, setCurrentExercise] = useState<Exercise | undefined>(exerciseLibraryEntry);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCurrentExercise(exerciseLibraryEntry);
    setNotes(exerciseLibraryEntry?.insightsNotes || '');
  }, [exerciseLibraryEntry]);

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
            {(exerciseLibraryEntry?.muscleGroup || (exerciseLibraryEntry as any)?.bodyPart) && (
              <Text style={styles.headerSubtitle}>
                {(exerciseLibraryEntry?.muscleGroup || (exerciseLibraryEntry as any)?.bodyPart || '').toUpperCase()}
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
                {/* Only show image area if a real imageUri exists */}
                {exerciseLibraryEntry?.imageUri && (
                  <View style={styles.imagePlaceholder}>
                    <Image
                      source={{ uri: exerciseLibraryEntry.imageUri }}
                      style={styles.exerciseImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* 1 — Targeted Muscle Groups & Anatomy */}
                {currentExercise?.muscleGroup && (
                  <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>TARGETED MUSCLE GROUPS & ANATOMY</Text>
                    <View style={styles.badgesRow}>
                      {/* Primary muscle — accent tint */}
                      <View style={[styles.detailsBadge, { backgroundColor: colors.accentGlow }]}>
                        <Text style={[styles.detailsBadgeText, { color: colors.accent }]}>
                          {getMuscleDisplayName(currentExercise.muscleGroup, exerciseNameLanguage).toUpperCase()}
                        </Text>
                      </View>

                      {/* Secondary muscles — slightly dimmer accent tint */}
                      <View style={[styles.detailsBadge, { backgroundColor: colors.accentGlow }]}>
                        <Text style={[styles.detailsBadgeText, { color: colors.textSecondary }]}>
                          {getSecondaryMuscles(currentExercise.muscleGroup).toUpperCase()}
                        </Text>
                      </View>

                      {/* Equipment */}
                      <View style={[styles.detailsBadge, { backgroundColor: colors.surfaceHigh }]}>
                        <Text style={[styles.detailsBadgeText, { color: colors.textSecondary }]}>
                          {(currentExercise.equipment || 'Other').toUpperCase()}
                        </Text>
                      </View>

                      {/* Bilateral / Unilateral */}
                      {currentExercise.isUnilateral !== undefined && (
                        <View style={[styles.detailsBadge, { backgroundColor: colors.surfaceHigh }]}>
                          <Text style={[styles.detailsBadgeText, { color: colors.textMuted }]}>
                            {currentExercise.isUnilateral ? 'UNILATERAL' : 'BILATERAL'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                )}

                {/* 2 — Exercise Insights Notes (moved up to 2nd) */}
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

                {/* 3 — Variations & Tags (polished design) */}
                {currentExercise && (
                  <Card style={[styles.sectionCard, styles.tagsCard]}>
                    <View style={styles.tagsCardHeader}>
                      <View style={styles.tagsCardHeaderLeft}>
                        <Ionicons name="bookmark-outline" size={14} color={colors.accent} />
                        <Text style={styles.sectionTitle}>VARIATIONS & TAGS</Text>
                      </View>
                      {currentExercise.variations && currentExercise.variations.length > 0 && (
                        <View style={styles.tagCountBadge}>
                          <Text style={styles.tagCountText}>{currentExercise.variations.length}</Text>
                        </View>
                      )}
                    </View>

                    {currentExercise.variations && currentExercise.variations.length > 0 ? (
                      <View style={styles.tagChipsContainer}>
                        {currentExercise.variations.map((tag) => (
                          <View key={tag} style={styles.cleanTagChip}>
                            <Text style={styles.cleanTagChipText}>{tag}</Text>
                            <Pressable
                              onPress={() => {
                                if (currentExercise) {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  const updated = removeVariationFromExercise(currentExercise, tag);
                                  setCurrentExercise(updated);
                                  if (onUpdateExerciseVariations) {
                                    onUpdateExerciseVariations(currentExercise.id, updated.variations || []);
                                  }
                                }
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ marginLeft: 6 }}
                            >
                              <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyTagText}>
                        No tags yet — add one below to filter workouts by variation.
                      </Text>
                    )}

                    <View style={styles.addTagRow}>
                      <TextInput
                        style={styles.addTagInput}
                        placeholder={i18n.t('variations.placeholder', { defaultValue: 'e.g. gym, home...' })}
                        placeholderTextColor={colors.textMuted}
                        value={newTagText}
                        onChangeText={setNewTagText}
                        keyboardAppearance="dark"
                        maxLength={40}
                        onSubmitEditing={() => {
                          if (!newTagText.trim() || !currentExercise) return;
                          if (!isValidTag(newTagText)) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const updated = addVariationToExercise(currentExercise, newTagText);
                          setCurrentExercise(updated);
                          if (onUpdateExerciseVariations) {
                            onUpdateExerciseVariations(currentExercise.id, updated.variations || []);
                          }
                          setNewTagText('');
                        }}
                        returnKeyType="done"
                      />
                      <Pressable
                        style={styles.addTagBtn}
                        onPress={() => {
                          if (!newTagText.trim()) return;
                          if (!isValidTag(newTagText)) {
                            Alert.alert(
                              i18n.t('common.error'),
                              i18n.t('variations.tooLong', { defaultValue: 'Tag name too long (max 40 chars)' })
                            );
                            return;
                          }
                          if (currentExercise) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const updated = addVariationToExercise(currentExercise, newTagText);
                            setCurrentExercise(updated);
                            if (onUpdateExerciseVariations) {
                              onUpdateExerciseVariations(currentExercise.id, updated.variations || []);
                            }
                            setNewTagText('');
                          }
                        }}
                        android_ripple={ripple.accent}
                      >
                        <Text style={styles.addTagBtnText}>{i18n.t('common.add', { defaultValue: 'Add' })}</Text>
                      </Pressable>
                    </View>
                  </Card>
                )}

                {/* 4 — Instructions */}
                {exerciseLibraryEntry?.instructions && (
                  <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>INSTRUCTIONS</Text>
                    {(Array.isArray(exerciseLibraryEntry.instructions)
                      ? exerciseLibraryEntry.instructions
                      : [exerciseLibraryEntry.instructions]
                    ).map((step: string, idx: number) => (
                      <View key={idx} style={styles.instructionStep}>
                        <View style={styles.stepBadge}>
                          <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{step}</Text>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Delete custom exercise */}
                {exerciseLibraryEntry?.id.startsWith('ex-custom-') && onDeleteExercise && (
                  <Pressable
                    style={styles.deleteExBtn}
                    onPress={() => {
                      if (onDeleteExercise && exerciseLibraryEntry) {
                        onDeleteExercise(exerciseLibraryEntry.id);
                        onClose();
                      }
                    }}
                    android_ripple={ripple.borderless}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={styles.deleteExBtnText}>{i18n.t('extras.deleteExerciseBtn', { defaultValue: 'DELETE EXERCISE' })}</Text>
                  </Pressable>
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
                  try {
                    const historyFromSessions = Array.isArray(sessions) ? sessions.reduce<any[]>((acc, session) => {
                      if (!session || !Array.isArray(session.exercises)) return acc;
                      const ex = session.exercises.find((e: any) => 
                        e && (
                          (typeof e.name === 'string' && e.name.toLowerCase() === exerciseName.toLowerCase()) ||
                          (e.id && exerciseLibraryEntry?.id && e.id === exerciseLibraryEntry.id)
                        )
                      );
                      if (ex) {
                        const rawSets = Array.isArray(ex.sets) ? ex.sets : (Array.isArray(ex.setsDetails) ? ex.setsDetails : []);
                        const normalizedSets = rawSets
                          .filter((s: any) => s != null)
                          .map((s: any) => ({
                            weightKg: Number(s.weightKg ?? s.weight ?? 0),
                            reps: Number(s.reps ?? 0),
                          }))
                          .filter((s: any) => !isNaN(s.reps) && !isNaN(s.weightKg) && (s.reps > 0 || s.weightKg > 0));

                        if (normalizedSets.length > 0) {
                          const dt = session.datetime ? new Date(session.datetime) : ((session as any).date ? new Date((session as any).date) : new Date());
                          const validDate = isNaN(dt.getTime()) ? new Date() : dt;
                          acc.push({
                            id: session.id || `sess-${validDate.getTime()}-${Math.random()}`,
                            date: validDate,
                            sets: normalizedSets,
                          });
                        }
                      }
                      return acc;
                    }, []) : [];

                    const historyFromMock = (Array.isArray(mockExerciseHistory) ? mockExerciseHistory : [])
                      .filter((h) => h && h.exerciseId === exerciseLibraryEntry?.id && Array.isArray(h.sets) && h.sets.length > 0)
                      .map((h) => ({
                        id: h.id,
                        date: new Date(h.date),
                        sets: h.sets.map((s: any) => ({ weightKg: Number(s.weightKg ?? 0), reps: Number(s.reps ?? 0) })),
                      }));

                    const combinedHistoryMap = new Map<string, any>();
                    [...historyFromSessions, ...historyFromMock].forEach((item) => {
                      if (!item || !item.date || isNaN(item.date.getTime())) return;
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
                  } catch (err) {
                    console.error('Error computing exercise history:', err);
                    return (
                      <View style={styles.emptyHistoryContainer}>
                        <Ionicons name="time-outline" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyHistoryText}>
                          No training history found for this exercise.
                        </Text>
                      </View>
                    );
                  }
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
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  detailsBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  detailsBadgeText: {
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  tagChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: spacing.xs,
  },
  cleanTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 142, 247, 0.15)',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  cleanTagChipText: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
    fontSize: font.sizes.xs,
  },
  emptyTagText: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginVertical: spacing.xs,
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    marginTop: spacing.sm,
  },
  addTagInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: font.sizes.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 38,
  },
  addTagBtnText: {
    color: colors.bg,
    fontFamily: font.bold,
    fontSize: font.sizes.xs,
  },
  deleteExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.error + '15',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.error + '40',
    marginTop: spacing.md,
  },
  deleteExBtnText: {
    color: colors.error,
    fontFamily: font.bold,
    fontSize: font.sizes.xs,
    letterSpacing: 0.5,
  },
  tagsCard: {
    borderWidth: 1,
    borderColor: colors.accent + '25',
  },
  tagsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tagsCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagCountBadge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tagCountText: {
    color: colors.bg,
    fontFamily: font.bold,
    fontSize: 10,
    lineHeight: 16,
  },
});

export default React.memo(ExerciseInsightsModal);
