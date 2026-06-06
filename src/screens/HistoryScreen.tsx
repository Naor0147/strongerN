// screens/HistoryScreen.tsx
import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../theme';
import { WorkoutSession, ExerciseSet } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import Card         from '../components/ui/Card';
import IconButton   from '../components/ui/IconButton';
import { sectionListGetItemLayout } from '../utils/listLayout';

interface HistoryScreenProps {
  sessions: WorkoutSession[];
  onResumeWorkout?: (session: WorkoutSession) => void;
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
const SessionCard: React.FC<{
  session: WorkoutSession;
  onResumeWorkout?: (session: WorkoutSession) => void;
}> = React.memo(({ session, onResumeWorkout }) => {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs }}>
          {hasPR && (
            <View style={styles.prBadge}>
              <Ionicons name="trophy" size={12} color={colors.gold} />
              <Text style={styles.prText}>{session.prs} PR</Text>
            </View>
          )}
          {onResumeWorkout && (
            <Pressable
              style={styles.resumeBtn}
              onPress={() => onResumeWorkout(session)}
              android_ripple={rippleTokens.accent}
              accessibilityLabel={`Resume or edit ${session.title} workout`}
            >
              <Ionicons name="play" size={10} color={colors.accent} style={{ marginRight: 2 }} />
              <Text style={styles.resumeBtnText}>EDIT / RESUME</Text>
            </Pressable>
          )}
        </View>
      </View>

      {session.comment ? (
        <Text style={styles.commentText}>{session.comment}</Text>
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
const HistoryScreen: React.FC<HistoryScreenProps> = ({ sessions, onResumeWorkout }) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<number | null>(null);
  // Calendar month/year navigation
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    if (globalAnimation.speed === 0) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: getScaledDuration(350),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: getScaledDuration(350),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 1. Search filter
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        s =>
          s.title.toLowerCase().includes(q) ||
          (s.comment && s.comment.toLowerCase().includes(q)) ||
          s.exercises.some(ex => ex.name.toLowerCase().includes(q))
      );
    }

    // Calendar day filter (uses navigated calendarMonth/calendarYear)
    if (selectedCalendarDate !== null) {
      result = result.filter(s => {
        const d = new Date(s.datetime);
        return d.getDate() === selectedCalendarDate && d.getMonth() === calendarMonth && d.getFullYear() === calendarYear;
      });
    }

    return result;
  }, [sessions, searchQuery, selectedCalendarDate]);

  // 2. Sections grouping
  const sections: SectionData[] = useMemo(() => {
    const map    = new Map<string, WorkoutSession[]>();
    const sorted = [...filteredSessions].sort((a, b) => b.datetime.getTime() - a.datetime.getTime());
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
  }, [filteredSessions]);

  const renderItem = useCallback(
    ({ item }: { item: WorkoutSession }) => (
      <SessionCard session={item} onResumeWorkout={onResumeWorkout} />
    ),
    [onResumeWorkout]
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

  const getItemLayout = useMemo(() =>
    sectionListGetItemLayout({
      getItemHeight: (sectionIndex, itemIndex) => {
        const item = sections[sectionIndex]?.data[itemIndex];
        if (!item) return 150;
        const baseHeight = 149;
        const commentHeight = item.comment ? 26 : 0;
        const exercisesHeight = (item.exercises || []).length * 26;
        return baseHeight + commentHeight + exercisesHeight;
      },
      getSectionHeaderHeight: () => 48,
    }),
    [sections]
  );

  const handleToggleSearch = () => {
    setIsSearching(!isSearching);
    if (isSearching) {
      setSearchQuery('');
    }
  };

  const handleToggleCalendar = () => {
    setIsCalendarVisible(!isCalendarVisible);
    setSelectedCalendarDate(null);
    // Reset to current month when opening calendar
    if (!isCalendarVisible) {
      setCalendarYear(new Date().getFullYear());
      setCalendarMonth(new Date().getMonth());
    }
  };

  const handlePrevMonth = () => {
    setSelectedCalendarDate(null);
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedCalendarDate(null);
    const now = new Date();
    // Don't navigate past current month
    if (calendarYear === now.getFullYear() && calendarMonth === now.getMonth()) return;
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

  // Generate Calendar Days for navigated month
  const calendarDays = useMemo(() => {
    // First day of the navigated month
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    // Total days in navigated month
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    
    // Map of days where user had workouts in the navigated month
    const workoutDays = new Set<number>();
    sessions.forEach(s => {
      const d = new Date(s.datetime);
      if (d.getMonth() === calendarMonth && d.getFullYear() === calendarYear) {
        workoutDays.add(d.getDate());
      }
    });

    const daysList = [];
    // Padding for empty days at start of week (Sunday is 0)
    for (let i = 0; i < firstDay; i++) {
      daysList.push({ day: null, hasWorkout: false });
    }
    // Days of the month
    for (let i = 1; i <= totalDays; i++) {
      daysList.push({
        day: i,
        hasWorkout: workoutDays.has(i)
      });
    }

    return daysList;
  }, [sessions, calendarMonth, calendarYear]);

  const monthName = useMemo(() => {
    return new Date(calendarYear, calendarMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [calendarMonth, calendarYear]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return calendarYear === now.getFullYear() && calendarMonth === now.getMonth();
  }, [calendarYear, calendarMonth]);

  const headerActions = useMemo(() => [
    {
      icon: isCalendarVisible ? 'calendar' as const : 'calendar-outline' as const,
      label: 'Calendar view',
      onPress: handleToggleCalendar,
      color: isCalendarVisible ? colors.highlight : colors.textPrimary
    },
    {
      icon: isSearching ? 'close-outline' as const : 'search-outline' as const,
      label: 'Search history',
      onPress: handleToggleSearch,
      color: isSearching ? colors.accent : colors.textPrimary
    },
  ], [isSearching, isCalendarVisible]);

  const subtitle = useMemo(() => {
    const isFiltered = searchQuery.trim() || selectedCalendarDate !== null;
    return isFiltered
      ? `Found ${filteredSessions.length} results`
      : `${sessions.length} total sessions`;
  }, [sessions.length, filteredSessions.length, searchQuery, selectedCalendarDate]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="History"
        subtitle={subtitle}
        actions={headerActions}
        testID="history.header"
      />

      {/* Modern inline search */}
      {isSearching && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search routine, exercise, or comments..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance="dark"
            />
          </View>
        </View>
      )}

      {/* Premium custom inline calendar grid */}
      {isCalendarVisible && (
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <View style={styles.monthNavRow}>
              <Pressable onPress={handlePrevMonth} style={styles.monthNavBtn}>
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </Pressable>
              <Text style={styles.calendarTitle}>{monthName.toUpperCase()}</Text>
              <Pressable 
                onPress={handleNextMonth} 
                style={[styles.monthNavBtn, isCurrentMonth && styles.monthNavBtnDisabled]}
                disabled={isCurrentMonth}
              >
                <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? colors.textMuted : colors.textPrimary} />
              </Pressable>
            </View>
            {selectedCalendarDate !== null && (
              <Pressable
                onPress={() => setSelectedCalendarDate(null)}
                style={styles.calResetBtn}
              >
                <Text style={styles.calResetBtnText}>Show All</Text>
              </Pressable>
            )}
          </View>

          {/* Weekday Labels */}
          <View style={styles.weekdayRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={styles.weekdayText}>{d}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.daysGrid}>
            {calendarDays.map((item, idx) => {
              const isSelected = selectedCalendarDate === item.day;
              return (
                <Pressable
                  key={idx}
                  disabled={item.day === null}
                  onPress={() => setSelectedCalendarDate(item.day)}
                  style={styles.dayCell}
                >
                  {item.day !== null && (
                    <View style={[
                      styles.dayInner,
                      styles.dayInnerActive,
                      isSelected && styles.dayInnerSelected,
                      item.hasWorkout && styles.dayInnerWorkout
                    ]}>
                      <Text style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        item.hasWorkout && styles.dayTextWorkout
                      ]}>
                        {item.day}
                      </Text>
                      {item.hasWorkout && !isSelected && (
                        <View style={styles.calDotGlow} />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          removeClippedSubviews
          maxToRenderPerBatch={6}
          windowSize={10}
        />
      </Animated.View>
    </View>
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
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.md,
  },
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    height:            44,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex:        1,
    color:       colors.textPrimary,
    fontSize:    font.sizes.md,
    fontFamily:  font.medium,
    height:      '100%',
    paddingVertical: 0,
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
  commentText: {
    color:        colors.textSecondary,
    fontSize:     font.sizes.sm,
    fontFamily:   font.medium,
    marginTop:    spacing.xs,
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

  // Premium Calendar
  calendarContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 16,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...(shadow.card as object),
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calendarTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthNavBtn: {
    padding: 4,
    marginHorizontal: 8,
  },
  monthNavBtnDisabled: {
    opacity: 0.3,
  },
  calResetBtn: {
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface2,
  },
  calResetBtnText: {
    color: colors.accent,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  weekdayRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: spacing.xs,
  },
  weekdayText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: font.bold,
    width: '14.28%',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    rowGap: 8,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    position: 'relative',
  },
  dayInnerActive: {
    backgroundColor: colors.surface2,
  },
  dayInnerSelected: {
    backgroundColor: colors.accent,
  },
  dayInnerWorkout: {
    backgroundColor: colors.successGlow + '20',
    borderColor: colors.success,
    borderWidth: 1,
  },
  dayText: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
  },
  dayTextSelected: {
    color: colors.textInverse,
    fontFamily: font.bold,
  },
  dayTextWorkout: {
    color: colors.success,
    fontFamily: font.bold,
  },
  calDotGlow: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
    position: 'absolute',
    bottom: 2,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.xs,
    backgroundColor: '#4F8EF718', // 10% opacity accent
    borderWidth: 1,
    borderColor: '#4F8EF740', // 25% opacity accent border
  },
  resumeBtnText: {
    color: colors.accent,
    fontSize: font.sizes.xs - 2,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
});

export default HistoryScreen;
