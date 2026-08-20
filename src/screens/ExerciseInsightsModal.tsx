import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  useWindowDimensions,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, shadow, ripple } from '../theme';
import { Exercise, WorkoutSession } from '../data/mockData';
import SegmentedControl from '../components/ui/SegmentedControl';
import Card from '../components/ui/Card';
import LineChart from '../components/ui/charts/LineChart';
import DistributionChart from '../components/ui/charts/DistributionChart';
import { exercise1RMSeries, estimate1RM } from '../utils/strength';
import {
  setsPerWeek,
  avgRepsPerWorkout,
} from '../utils/exerciseStats';
import { getExercisePercentile } from '../utils/strengthDistributionEngine';
import {
  buildExerciseSessionHistory,
  ExerciseHistorySession,
  ExerciseHistorySet,
} from '../utils/exerciseHistory';

import i18n from '../utils/i18n';
import { getDisplayName, getMuscleDisplayName } from '../utils/exerciseNames';
import { addVariationToExercise, removeVariationFromExercise, isValidTag } from '../utils/variationUtils';
import { countCompletedSetsInExercise } from '../utils/setCounting';

const getCategoryPillStyle = (category: string) => {
  switch (category) {
    case 'W':
      return { backgroundColor: colors.surfaceHigh, borderColor: colors.border };
    case 'D':
      return { backgroundColor: colors.highlightGlow, borderColor: colors.highlight };
    case 'F':
      return { backgroundColor: colors.errorGlow, borderColor: colors.error };
    default:
      return { backgroundColor: colors.accentGlow, borderColor: colors.accent };
  }
};

const getCategoryTextStyle = (category: string) => {
  switch (category) {
    case 'W':
      return { color: colors.textMuted };
    case 'D':
      return { color: colors.highlight };
    case 'F':
      return { color: colors.error };
    default:
      return { color: colors.accent };
  }
};

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
            {i18n.t('exerciseInsights.unableToLoadChart')}
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: font.regular, fontSize: font.sizes.sm, textAlign: 'center', marginTop: spacing.xs }}>
            {i18n.t('exerciseInsights.chartErrorMsg')}
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
  userBodyweight?: number;
  userGender?: 'male' | 'female';
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
  userBodyweight,
  userGender,
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

  const hasValidProfileMetrics = typeof userBodyweight === 'number' && userBodyweight > 0 && Boolean(userGender);

  const strengthPercentile = useMemo(() => {
    if (!hasValidProfileMetrics) return 50;
    const series1RM = exercise1RMSeries(exerciseName, sessions);
    const current1RM = series1RM.length > 0 ? series1RM[series1RM.length - 1].value : 0;
    return getExercisePercentile(exerciseName, current1RM, userBodyweight, userGender);
  }, [exerciseName, sessions, userBodyweight, userGender, hasValidProfileMetrics]);

  useEffect(() => {
    setNotes(exerciseLibraryEntry?.insightsNotes || '');
  }, [exerciseLibraryEntry]);

  const tabs = [
    { key: 'info', label: i18n.t('exerciseInsights.info'), icon: 'information-circle-outline' },
    { key: 'data', label: i18n.t('exerciseInsights.data'), icon: 'analytics-outline' },
    { key: 'history', label: i18n.t('exerciseInsights.history'), icon: 'time-outline' },
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

  const lifetimeCompletedSets = useMemo(() => {
    let count = 0;
    const nameLower = exerciseName.toLowerCase().trim();
    sessions.forEach((s) => {
      (s.exercises || []).forEach((e: any) => {
        if ((e.name || '').toLowerCase().trim() === nameLower) {
          count += countCompletedSetsInExercise(e);
        }
      });
    });
    return count;
  }, [exerciseName, sessions]);

  const historyData = useMemo(
    () => buildExerciseSessionHistory(exerciseName, sessions),
    [exerciseName, sessions]
  );

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

  const renderEmptyHistory = useCallback(() => (
    <View style={styles.emptyHistoryContainer}>
      <Ionicons name="time-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyHistoryText}>
        {i18n.t('exerciseInsights.noHistoryFound')}
      </Text>
    </View>
  ), []);

  const renderHistoryCard = useCallback(({ item }: { item: ExerciseHistorySession }) => {
    const isExpanded = !!expandedSessions[item.id];
    const day = String(item.date.getDate()).padStart(2, '0');
    const month = String(item.date.getMonth() + 1).padStart(2, '0');
    const year = item.date.getFullYear();
    const dateString = `${day}.${month}.${year}`;

    return (
      <Card
        key={item.id}
        padding={0}
        style={styles.historyCard}
      >
        <Pressable
          onPress={() => toggleSessionExpand(item.id)}
          android_ripple={ripple.surface}
          style={({ pressed }) => [
            styles.cardPressable,
            pressed && Platform.OS === 'ios' && { opacity: 0.7 },
          ]}
          testID={`history-session-card-${item.id}`}
        >
          {/* Card Header: Workout Title, Date & PR Badges */}
          <View style={styles.historyCardHeader}>
            <View style={styles.historyTitleRow}>
              <Text style={styles.historyWorkoutTitle} numberOfLines={1}>
                {item.workoutTitle}
              </Text>
              <Text style={styles.historyDateText}>{dateString}</Text>
            </View>
            <View style={styles.prBadgesRow}>
              {item.isPr1RM && (
                <View style={[styles.prBadge, { backgroundColor: colors.highlightGlow, borderColor: colors.highlight }]}>
                  <Ionicons name="trophy" size={10} color={colors.highlight} style={{ marginRight: 3 }} />
                  <Text style={[styles.prBadgeText, { color: colors.highlight }]}>PR 1RM</Text>
                </View>
              )}
              {item.isPrWeight && (
                <View style={[styles.prBadge, { backgroundColor: colors.goldGlow, borderColor: colors.gold }]}>
                  <Ionicons name="flame" size={10} color={colors.gold} style={{ marginRight: 3 }} />
                  <Text style={[styles.prBadgeText, { color: colors.gold }]}>MAX WT</Text>
                </View>
              )}
            </View>
          </View>

          {/* Metrics Summary Row */}
          <View style={styles.metricsContainerCompact}>
            <View style={[styles.metricColumnLeft, { alignItems: 'flex-start' }]}>
              <Text style={styles.metricLabel}>{i18n.t('exerciseInsights.bestSet')}</Text>
              <Text style={styles.metricValue}>
                {item.bestSet ? `${item.bestSet.weightKg}kg × ${item.bestSet.reps}` : '-'}
              </Text>
            </View>
            <View style={[styles.metricColumnCenter, { alignItems: 'center' }]}>
              <Text style={styles.metricLabel}>{i18n.t('exerciseInsights.est1RM')}</Text>
              <Text style={styles.metricValue}>
                {item.best1RM > 0 ? `${item.best1RM}kg` : '-'}
              </Text>
            </View>
            <View style={[styles.metricColumnRight, { alignItems: 'flex-end' }]}>
              <Text style={styles.metricLabel}>{i18n.t('profile.sets', { defaultValue: 'SETS' }).toUpperCase()}</Text>
              <Text style={styles.metricValue}>
                {`${item.completedSetsCount}/${item.sets.length}`}
              </Text>
            </View>
          </View>

          <View style={styles.bottomChevronContainer}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textMuted}
            />
          </View>

          {isExpanded && (
            <View style={styles.expandedContainer}>
              <View style={styles.expandedSetsList}>
                {item.sets.map((set, setIdx) => (
                  <View key={setIdx} style={styles.expandedSetRow}>
                    <View style={styles.setRowLeft}>
                      <Text style={styles.expandedSetIndexText}>
                        {set.setNumber || setIdx + 1}
                      </Text>
                      {set.category && set.category !== 'S' && (
                        <View style={[styles.categoryPill, getCategoryPillStyle(set.category)]}>
                          <Text style={[styles.categoryPillText, getCategoryTextStyle(set.category)]}>
                            {set.category}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.setRowCenter}>
                      <Text style={styles.expandedSetDetailsText}>
                        <Text style={styles.expandedSetValueText}>{set.weightKg}</Text>
                        <Text style={styles.expandedSetUnitText}>kg</Text>
                        <Text style={styles.expandedSetTimesText}>  ×  </Text>
                        <Text style={styles.expandedSetValueText}>{set.reps}</Text>
                        <Text style={styles.expandedSetUnitText}> reps</Text>
                      </Text>
                      {set.isUnilateral && (set.leftWeightKg !== undefined || set.rightWeightKg !== undefined) && (
                        <Text style={styles.unilateralDetailsText}>
                          {`L: ${set.leftWeightKg ?? set.weightKg}kg × ${set.leftReps ?? set.reps ?? '-'} | R: ${set.rightWeightKg ?? set.weightKg}kg × ${set.rightReps ?? set.reps ?? '-'}`}
                        </Text>
                      )}
                    </View>

                    <View style={styles.setRowRight}>
                      {set.rpe !== undefined && (
                        <Text style={styles.rpeText}>@{set.rpe}</Text>
                      )}
                      <Ionicons
                        name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={set.completed ? colors.success : colors.textMuted}
                        style={{ marginLeft: spacing.xs }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Pressable>
      </Card>
    );
  }, [expandedSessions, toggleSessionExpand]);

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
                {lifetimeCompletedSets > 0 ? ` · ${lifetimeCompletedSets} ${i18n.t('profile.sets')}` : ''}
              </Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Segmented Control Tab Bar */}
        <View style={styles.tabsWrapper}>
          <SegmentedControl tabs={tabs} activeKey={activeTab} onChange={(k) => setActiveTab(k as any)} />
        </View>

        {/* Tab Content */}
        <TabErrorBoundary key={activeTab}>
          {activeTab === 'history' ? (
            <FlatList<ExerciseHistorySession>
              data={historyData}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryCard}
              contentContainerStyle={styles.historyListContent}
              ListEmptyComponent={renderEmptyHistory}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                      <Text style={styles.sectionTitle}>{i18n.t('exerciseInsights.targetedMusclesHeader')}</Text>
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
                        <Text style={styles.sectionTitle}>{i18n.t('exerciseInsights.notesHeader')}</Text>
                        {savedJustNow && (
                          <Text style={styles.savedBadgeText}>{i18n.t('common.saved', { defaultValue: 'Saved' })}</Text>
                        )}
                      </View>
                      <TextInput
                        style={styles.notesInput}
                        value={notes}
                        onChangeText={setNotes}
                        onBlur={handleAutoSaveNotes}
                        placeholder={i18n.t('exerciseInsights.notesPlaceholder')}
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
                          <Text style={styles.sectionTitle}>{i18n.t('exerciseInsights.variationsHeader')}</Text>
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
                          {i18n.t('exerciseInsights.noTagsYet')}
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
                      <Text style={styles.sectionTitle}>{i18n.t('exerciseInsights.instructionsHeader')}</Text>
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
                    hasValidProfileMetrics ? (
                      <View style={styles.chartWrapper}>
                        <DistributionChart
                          title={i18n.t('exerciseInsights.est1RMDistribution')}
                          percentile={strengthPercentile}
                        />
                      </View>
                    ) : (
                      <View style={styles.chartWrapper}>
                        <Card style={styles.percentileHintCard} padding={spacing.md}>
                          <View style={styles.percentileHintRow}>
                            <Ionicons name="information-circle-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.percentileHintText}>
                              {i18n.t('exerciseInsights.percentileHint', { defaultValue: 'Set bodyweight & gender in Profile to unlock strength percentiles' })}
                            </Text>
                          </View>
                        </Card>
                      </View>
                    )
                  )}

                  <View style={styles.chartWrapper}>
                    <LineChart
                      title={i18n.t('exerciseInsights.est1RMOverTime')}
                      data={chartData.series1RM}
                      color={colors.accent}
                      height={150}
                      yAxisFormatter={(val) => `${Math.round(val)}kg`}
                    />
                  </View>

                  <View style={styles.chartWrapper}>
                    <LineChart
                      title={i18n.t('exerciseInsights.setsPerWeek')}
                      data={chartData.weeklySetsSeries}
                      color={colors.accent}
                      height={150}
                      yAxisFormatter={(val) => `${Math.round(val)} sets`}
                    />
                  </View>

                  <View style={styles.chartWrapper}>
                    <LineChart
                      title={i18n.t('exerciseInsights.avgRepsPerWorkout')}
                      data={chartData.repsSeries}
                      color={colors.highlight}
                      height={150}
                      yAxisFormatter={(val) => `${Math.round(val * 10) / 10}`}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </TabErrorBoundary>
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
  historyListContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  historyCard: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  cardPressable: {
    padding: spacing.md,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  historyTitleRow: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historyWorkoutTitle: {
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    color: colors.textPrimary,
  },
  historyDateText: {
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  prBadgesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  prBadgeText: {
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  metricsContainerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  setRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    gap: spacing.xs,
  },
  setRowCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  setRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 50,
  },
  categoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 10,
    fontFamily: font.bold,
  },
  expandedSetIndexText: {
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    color: colors.textMuted,
    width: 18,
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
  unilateralDetailsText: {
    fontSize: 10,
    fontFamily: font.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
  rpeText: {
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
    color: colors.textSecondary,
    marginRight: spacing.xs,
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
    backgroundColor: colors.accentGlow,
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
    backgroundColor: colors.errorGlow,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.errorGlow,
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
    borderColor: colors.accentGlow,
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
  percentileHintCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  percentileHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentileHintText: {
    color: colors.textSecondary,
    fontFamily: font.medium,
    fontSize: font.sizes.xs,
    flex: 1,
    lineHeight: 18,
  },
});

export default React.memo(ExerciseInsightsModal);
