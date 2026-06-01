// screens/HistoryScreen.tsx
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius } from '../theme';
import { WorkoutSession, ExerciseSet } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import Card         from '../components/ui/Card';

interface HistoryScreenProps {
  sessions: WorkoutSession[];
}

interface SectionData {
  title: string;
  count: number;
  data:  WorkoutSession[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
  });
}

function formatMonthKey(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatVolume(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`;
}

// ─── Stat Chip ────────────────────────────────────────────────────
interface ChipProps {
  icon:   keyof typeof Ionicons.glyphMap;
  label:  string;
  color?: string;
}
const Chip: React.FC<ChipProps> = ({ icon, label, color = colors.textSecondary }) => (
  <View style={[styles.chip, { backgroundColor: color + '18', borderColor: color + '40' }]}>
    <Ionicons name={icon} size={11} color={color} />
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
);

// ─── Exercise Row ─────────────────────────────────────────────────
const ExerciseRow: React.FC<{ exercise: ExerciseSet }> = React.memo(({ exercise }) => (
  <View style={styles.exRow}>
    <Text style={styles.exSets} numberOfLines={1}>
      {exercise.sets}
      <Text style={styles.exX}>×</Text> {exercise.name}
    </Text>
    <Text style={styles.exBest}>
      {exercise.bestWeight}kg × {exercise.bestReps}
      {exercise.rpe != null ? (
        <Text style={styles.exRpe}>  @{exercise.rpe}</Text>
      ) : null}
    </Text>
  </View>
));

// ─── Session Card ─────────────────────────────────────────────────
const SessionCard: React.FC<{ session: WorkoutSession }> = React.memo(({ session }) => {
  const hasPR   = session.prs > 0;
  const variant = hasPR ? 'highlight' : 'default';

  return (
    <Card
      style={styles.sessionCard}
      padding={spacing.lg}
      variant={variant}
      testID={`history.session.${session.id}`}
    >
      {/* Header */}
      <View style={styles.sessionHeader}>
        <View style={styles.sessionTitleBlock}>
          <Text style={styles.sessionTitle}>{session.title}</Text>
          <Text style={styles.sessionDate}>{formatDate(session.datetime)}</Text>
        </View>
        {hasPR && (
          <View style={styles.prBadge}>
            <Ionicons name="trophy" size={12} color={colors.gold} />
            <Text style={styles.prText}>{session.prs} PR</Text>
          </View>
        )}
      </View>

      {session.comment ? (
        <Text style={styles.comment}>{session.comment}</Text>
      ) : null}

      {/* Exercise table header */}
      <View style={styles.tableHeader}>
        <Text style={styles.tableCol}>Sets</Text>
        <Text style={styles.tableCol}>Best set</Text>
      </View>

      {session.exercises.map((ex, i) => (
        <ExerciseRow key={ex.name + i} exercise={ex} />
      ))}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Chips footer */}
      <View style={styles.chips}>
        <Chip icon="time-outline"    label={`${session.durationMinutes}m`}           color={colors.textSecondary} />
        <Chip icon="barbell-outline" label={formatVolume(session.totalVolumeKg)}       color={colors.accent} />
        {hasPR && (
          <Chip icon="trophy-outline" label={`${session.prs} PR${session.prs > 1 ? 's' : ''}`} color={colors.gold} />
        )}
      </View>
    </Card>
  );
});

// ─── Screen ────────────────────────────────────────────────────────
const HistoryScreen: React.FC<HistoryScreenProps> = ({ sessions }) => {
  const sections: SectionData[] = useMemo(() => {
    const map    = new Map<string, WorkoutSession[]>();
    const sorted = [...sessions].sort((a, b) => b.datetime.getTime() - a.datetime.getTime());
    for (const s of sorted) {
      const key = formatMonthKey(s.datetime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([title, data]) => ({
      title,
      count: data.length,
      data,
    }));
  }, [sessions]);

  const renderItem = useCallback(
    ({ item }: { item: WorkoutSession }) => <SessionCard session={item} />,
    []
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <View style={styles.monthHeader}>
        <View style={styles.monthLeft}>
          <View style={styles.monthDot} />
          <Text style={styles.monthLabel}>{section.title.toUpperCase()}</Text>
        </View>
        <Text style={styles.monthCount}>{section.count} workouts</Text>
      </View>
    ),
    []
  );

  const keyExtractor = useCallback((item: WorkoutSession) => item.id, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="History"
        actions={[
          { icon: 'calendar-outline', label: 'Calendar view', testID: 'history.calendar' },
          { icon: 'search-outline',   label: 'Search history', testID: 'history.search' },
        ]}
        testID="history.header"
      />
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={10}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxxl,
  },

  // Month header
  monthHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      spacing.xl,
    marginBottom:   spacing.md,
    paddingLeft:    2,
  },
  monthLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.sm,
  },
  monthDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.accent,
    shadowColor:     colors.accent,
    shadowOpacity:   0.8,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       3,
  },
  monthLabel: {
    color:         colors.textSecondary,
    fontSize:      font.sizes.sm,
    fontFamily:    font.semibold,
    letterSpacing: 1.5,
  },
  monthCount: {
    color:      colors.textMuted,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
  },

  // Session card
  sessionCard: {
    marginBottom: spacing.md,
  },
  sessionHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.xs,
  },
  sessionTitleBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  sessionTitle: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.bold,
    letterSpacing: -0.2,
  },
  sessionDate: {
    color:     colors.textMuted,
    fontSize:  font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 2,
  },
  prBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    columnGap:         3,
    backgroundColor:   colors.goldGlow,
    borderColor:       colors.gold,
    borderWidth:       1,
    borderRadius:      radius.full,
    paddingVertical:   3,
    paddingHorizontal: spacing.sm,
  },
  prText: {
    color:      colors.gold,
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
  },
  comment: {
    color:        colors.textSecondary,
    fontSize:     font.sizes.sm,
    fontStyle:    'italic',
    fontFamily:   font.regular,
    marginBottom: spacing.sm,
  },

  // Table
  tableHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      spacing.sm,
    marginBottom:   spacing.xs,
    paddingBottom:  spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCol: {
    color:      colors.textMuted,
    fontSize:   font.sizes.xs,
    fontFamily: font.medium,
    letterSpacing: 0.5,
  },

  // Exercise rows
  exRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    paddingVertical: 4,
  },
  exSets: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
    flex:       1,
    marginRight: spacing.sm,
  },
  exX: {
    color: colors.textMuted,
  },
  exBest: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
  },
  exRpe: {
    color:      colors.textMuted,
    fontFamily: font.regular,
  },

  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginVertical:  spacing.md,
  },

  // Chips
  chips: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    columnGap:     spacing.sm,
    rowGap:        spacing.xs,
  },
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    columnGap:       4,
    borderWidth:     1,
    borderRadius:    radius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    fontSize:   font.sizes.xs,
    fontFamily: font.medium,
  },
});

export default HistoryScreen;
