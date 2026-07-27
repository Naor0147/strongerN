// screens/ExercisesScreen.tsx
import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { InteractionManager } from 'react-native';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TextInput,
  Platform,
  Modal,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import * as RN from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration, getSpringConfig } from '../theme';
import { Exercise } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import PressableRow from '../components/ui/PressableRow';
import IconButton   from '../components/ui/IconButton';
import { sectionListGetItemLayout } from '../utils/listLayout';
import i18n from '../utils/i18n';
import { exerciseMatchesQuery, getDisplayName, getMuscleDisplayName } from '../utils/exerciseNames';
import { normalizeTag, isValidTag, addVariationToExercise, removeVariationFromExercise } from '../utils/variationUtils';
import ExerciseInsightsModal from './ExerciseInsightsModal';
import { showToast } from '../utils/toast';

const ITEM_HEIGHT   = 72;
const HEADER_HEIGHT = 48;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };
const HIT_SLOP_12 = { top: 12, bottom: 12, left: 12, right: 12 };

interface ExercisesScreenProps {
  exercises: Exercise[];
  onAddExercise?: (name: string, muscleGroup: string, equipment: string, isUnilateral?: boolean) => void;
  onDeleteExercise?: (id: string) => void;
  onUpdateExerciseNotes?: (id: string, notes?: string) => void;
  onUpdateExercise?: (id: string, name: string, muscleGroup: string, equipment: string, isUnilateral: boolean) => void;
  onUpdateExerciseVariations?: (id: string, variations: string[]) => void;
  sessions?: any[];
  exerciseNameLanguage?: 'en' | 'he';
}

interface AlphaSection {
  letter: string;
  data:   Exercise[];
}

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps', 'Glutes', 'Rear Delts', 'Calves', 'Core', 'Forearms'
];

const EQUIPMENT_TYPES = [
  'Barbell', 'Dumbbell', 'Machine', 'Cables', 'Bodyweight', 'Other'
];

// Map muscle groups to their specific premium colors from theme
const getMuscleColor = (muscleGroup: string): string => {
  const group = muscleGroup.toLowerCase();
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
  const group = primary.toLowerCase();
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

// ─────────────────────────────────────────────────────────────────────────────
// Pure function — extracted at module scope so it is never re-created and
// can be called from both InteractionManager callbacks and unit tests.
// ─────────────────────────────────────────────────────────────────────────────
function computeEnrichedExercises(exercises: Exercise[], sessions: any[]): Exercise[] {
  const weeklyCounts: Record<string, number> = {};
  const allTimeCounts: Record<string, number> = {};
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const normalizedExKeys = new Map<string, string>();
  const getNormalizedKey = (name: string) => {
    let key = normalizedExKeys.get(name);
    if (!key) {
      key = name.toLowerCase().trim();
      normalizedExKeys.set(name, key);
    }
    return key;
  };

  sessions.forEach((session: any) => {
    const sessDate = new Date(session.datetime).getTime();
    const isLast7Days = sessDate >= sevenDaysAgo;

    if (session.exercises) {
      session.exercises.forEach((ex: any) => {
        if (ex.name) {
          const exKey = getNormalizedKey(ex.name);
          const setsCount = typeof ex.sets === 'number' ? ex.sets : (ex.setsDetails?.length || 0);

          allTimeCounts[exKey] = (allTimeCounts[exKey] || 0) + setsCount;
          if (isLast7Days) {
            weeklyCounts[exKey] = (weeklyCounts[exKey] || 0) + setsCount;
          }
        }
      });
    }
  });

  return exercises.map(ex => {
    const exKey = getNormalizedKey(ex.name);
    return {
      ...ex,
      weeklySets: weeklyCounts[exKey] || 0,
      allTimeSets: (allTimeCounts[exKey] || 0) || (ex.allTimeSets || 0),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton shimmer — renders while data is being enriched post-transition.
// Zero layout computation cost, AMOLED-safe colours.
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRow: React.FC = React.memo(() => {
  const opacity = useSharedValue(0.35);

  React.useEffect(() => {
    opacity.value = withTiming(0.7, { duration: 700 }, () => {
      opacity.value = withTiming(0.35, { duration: 700 });
    });
    // Infinite ping-pong handled externally per list — see SkeletonList
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[skeletonStyles.row, animStyle]}>
      <View style={skeletonStyles.thumb} />
      <View style={skeletonStyles.center}>
        <View style={skeletonStyles.lineLong} />
        <View style={skeletonStyles.lineShort} />
      </View>
      <View style={skeletonStyles.right}>
        <View style={skeletonStyles.pill} />
      </View>
    </Animated.View>
  );
});

const SKELETON_ROW_COUNT = 9;

const SkeletonList: React.FC = React.memo(() => {
  const opacity = useSharedValue(0.35);

  React.useEffect(() => {
    // Infinite smooth ping-pong shimmer on the animation thread
    const start = () => {
      opacity.value = withTiming(0.75, { duration: 650 }, (finished) => {
        if (finished) opacity.value = withTiming(0.35, { duration: 650 }, (f2) => { if (f2) start(); });
      });
    };
    start();
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[skeletonStyles.container, animStyle]}>
      {/* Section header placeholder */}
      <View style={skeletonStyles.sectionHeader}>
        <View style={skeletonStyles.sectionLetter} />
        <View style={skeletonStyles.sectionLine} />
      </View>
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <View key={i} style={skeletonStyles.row}>
          <View style={skeletonStyles.thumb} />
          <View style={skeletonStyles.center}>
            <View style={[skeletonStyles.lineLong, i % 3 === 0 && { width: '55%' }]} />
            <View style={skeletonStyles.lineShort} />
          </View>
          <View style={skeletonStyles.right}>
            <View style={skeletonStyles.pill} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
});

const ROW_PADDING = { vertical: spacing.md, horizontal: spacing.lg };

const ExerciseRow: React.FC<{
  exercise: Exercise;
  onPress: (ex: Exercise) => void;
  onMenuPress: (ex: Exercise) => void;
  exerciseNameLanguage?: 'en' | 'he';
}> = React.memo(({ exercise, onPress, onMenuPress, exerciseNameLanguage = 'en' }) => {
  const muscleColor = useMemo(() => getMuscleColor(exercise.muscleGroup), [exercise.muscleGroup]);
  const [expanded, setExpanded] = useState(false);

  const handlePress = useCallback(() => onPress(exercise), [exercise, onPress]);
  const handleMenuPress = useCallback(() => onMenuPress(exercise), [exercise, onMenuPress]);
  const handleToggleExpand = useCallback(() => setExpanded(prev => !prev), []);

  const displayName = useMemo(() => getDisplayName(exercise.name, exerciseNameLanguage), [exercise.name, exerciseNameLanguage]);
  const thumbStyle = useMemo(() => [styles.thumb, { backgroundColor: muscleColor + '12', borderColor: muscleColor + '40' }], [muscleColor]);

  const actionSlot = useMemo(() => (
    <IconButton
      name="ellipsis-horizontal"
      size={18}
      color={colors.textSecondary}
      onPress={handleMenuPress}
      accessibilityLabel="Exercise options"
      style={styles.menuBtn}
    />
  ), [handleMenuPress]);

  return (
    <View style={styles.rowOuter}>
      <PressableRow
        onPress={handlePress}
        style={styles.rowContainer}
        padding={ROW_PADDING}
        testID={`exercises.exercise.${exercise.id}`}
        accessibilityLabel={`${displayName}, ${exercise.muscleGroup}, ${(exercise as any).allTimeSets || 0} total sets`}
        actionSlot={actionSlot}
      >
        <View style={styles.rowContent}>
          {/* Dynamic color-coded muscle group indicator */}
          <View style={thumbStyle}>
            <Text style={[styles.thumbText, { color: muscleColor }]}>
              {exercise.muscleGroup[0].toUpperCase()}
            </Text>
          </View>

          <View style={styles.rowCenter}>
            <Text style={styles.exerciseName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.badgeContainer}>
              <Text style={[styles.muscleGroup, { color: muscleColor }]}>
                {exercise.muscleGroup.toUpperCase()}
              </Text>
              <Text style={styles.badgeDot}>•</Text>
              <Text style={[styles.equipmentBadge, { color: colors.highlight }]}>
                {(exercise.equipment || 'Other').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.rowRight}>
            <Text style={styles.weeklySets}>{(exercise as any).allTimeSets || 0}</Text>
            <Text style={styles.setsLabel}>{i18n.t('extras.allTimeSets')}</Text>
          </View>
        </View>
      </PressableRow>

      {exercise.notes ? (
        <Pressable
          onPress={handleToggleExpand}
          style={styles.notesContainer}
        >
          <Text style={styles.noteSubtitle} numberOfLines={expanded ? undefined : 2}>
            {exercise.notes}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const EMPTY_SESSIONS: any[] = [];

const ExercisesScreen: React.FC<ExercisesScreenProps> = ({ 
  exercises, 
  onAddExercise, 
  onDeleteExercise, 
  onUpdateExerciseNotes,
  onUpdateExercise,
  onUpdateExerciseVariations,
  sessions = EMPTY_SESSIONS,
  exerciseNameLanguage = 'en',
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'alphabetical-asc' | 'alphabetical-desc' | 'sets'>('alphabetical-asc');
  const [isFilterBarVisible, setIsFilterBarVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isInsightsModalVisible, setIsInsightsModalVisible] = useState(false);
  const [selectedExerciseState, setSelectedExercise] = useState<Exercise | null>(null);

  // ── Memoized & Deferred data enrichment ─────────────────────────────────────
  // Enriched exercises calculations are memoized so tab revisit is instant (0ms drop).
  // Initial compute is scheduled post-transition to keep navigation silky smooth.
  const [isDataReady, setIsDataReady] = useState(true);

  const enrichedExercises = useMemo(() => {
    return computeEnrichedExercises(exercises, sessions);
  }, [exercises, sessions]);

  const selectedExercise = useMemo(() => {
    if (!selectedExerciseState) return null;
    return enrichedExercises.find(e => e.id === selectedExerciseState.id) || selectedExerciseState;
  }, [selectedExerciseState, enrichedExercises]);

  const detailsMuscleColor = useMemo(
    () => selectedExercise ? getMuscleColor(selectedExercise.muscleGroup) : colors.accent,
    [selectedExercise]
  );

  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.96);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
    flex: 1,
  }));

  React.useEffect(() => {
    fadeAnim.value = 0;
    scaleAnim.value = 0.96;
    const easingFn = Easing && typeof Easing.out === 'function' ? Easing.out(Easing.cubic) : undefined;
    fadeAnim.value = withTiming(1, { duration: 280, easing: easingFn });
    scaleAnim.value = withSpring(1, getSpringConfig(140, 16));
  }, []);

  // Context Menu and Notes states
  const [isContextMenuVisible, setIsContextMenuVisible] = useState(false);
  const [contextMenuExercise, setContextMenuExercise] = useState<Exercise | null>(null);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [noteEditExercise, setNoteEditExercise] = useState<Exercise | null>(null);
  const [noteText, setNoteText] = useState('');

  // New Exercise Form States
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');
  const [newExUnilateral, setNewExUnilateral] = useState(false);
  const [newExShowAdvanced, setNewExShowAdvanced] = useState(false);

  // Edit Exercise Form States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const editExIdRef = useRef('');
  const [editExName, setEditExName] = useState('');
  const [editExMuscle, setEditExMuscle] = useState('Chest');
  const [editExEquipment, setEditExEquipment] = useState('Barbell');
  const [editExUnilateral, setEditExUnilateral] = useState(false);
  const [editExShowAdvanced, setEditExShowAdvanced] = useState(false);

  // Toggle muscle filter
  const handleToggleMuscle = useCallback((muscle: string) => {
    setSelectedMuscles(prev =>
      prev.includes(muscle)
        ? prev.filter(m => m !== muscle)
        : [...prev, muscle]
    );
  }, []);

  // Toggle equipment filter
  const handleToggleEquipment = useCallback((eq: string) => {
    setSelectedEquipment(prev =>
      prev.includes(eq)
        ? prev.filter(e => e !== eq)
        : [...prev, eq]
    );
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedMuscles([]);
    setSelectedEquipment([]);
    setSearchQuery('');
  }, []);

  // 1. Filter exercises based on search query, active muscles, and active equipment
  const filteredExercises = useMemo(() => {
    // Filter out null/undefined or nameless exercises to avoid crashes
    let result = (enrichedExercises || []).filter(ex => ex && typeof ex.name === 'string' && ex.name.trim().length > 0);

    // Search query filter (cross-lingual)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        ex => {
          const name = ex.name || '';
          const muscleGroup = ex.muscleGroup || '';
          const equipment = ex.equipment || '';
          return (
            exerciseMatchesQuery(name, query) ||
            muscleGroup.toLowerCase().includes(query) ||
            equipment.toLowerCase().includes(query)
          );
        }
      );
    }

    // Muscle groups filter
    if (selectedMuscles.length > 0) {
      result = result.filter(ex => selectedMuscles.includes(ex.muscleGroup));
    }

    // Equipment filter
    if (selectedEquipment.length > 0) {
      result = result.filter(ex => selectedEquipment.includes(ex.equipment || 'Other'));
    }

    return result;
  }, [enrichedExercises, searchQuery, selectedMuscles, selectedEquipment]);

  // 2. Sort exercises — fast V8 string comparison (20x faster than localeCompare)
  const sortedExercises = useMemo(() => {
    const result = [...filteredExercises];
    if (sortMode === 'alphabetical-asc') {
      result.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    } else if (sortMode === 'alphabetical-desc') {
      result.sort((a, b) => (a.name > b.name ? -1 : a.name < b.name ? 1 : 0));
    } else if (sortMode === 'sets') {
      result.sort((a, b) => ((b as any).allTimeSets || 0) - ((a as any).allTimeSets || 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }
    return result;
  }, [filteredExercises, sortMode]);

  // 3. Group into sections
  const sections: AlphaSection[] = useMemo(() => {
    if (sortMode === 'sets') {
      // If sorted by sets, we group by "All-time Sets Range"
      const map = new Map<string, Exercise[]>();
      for (const ex of sortedExercises) {
        const setsCount = (ex as any).allTimeSets || 0;
        let label = i18n.t('extras.zeroSets');
        if (setsCount > 50) label = i18n.t('extras.centuryClub');
        else if (setsCount > 20) label = i18n.t('extras.highVolume');
        else if (setsCount > 5) label = i18n.t('extras.moderateVolume');
        else if (setsCount > 0) label = i18n.t('extras.lowVolume');
        
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(ex);
      }
      return Array.from(map.entries()).map(([letter, data]) => ({ letter, data }));
    } else {
      // Group alphabetically
      const map = new Map<string, Exercise[]>();
      for (const ex of sortedExercises) {
        const letter = ex.name[0].toUpperCase();
        if (!map.has(letter)) map.set(letter, []);
        map.get(letter)!.push(ex);
      }
      return Array.from(map.entries()).map(([letter, data]) => ({ letter, data }));
    }
  }, [sortedExercises, sortMode]);

  const handleRowPress = useCallback((ex: Exercise) => {
    setSelectedExercise(ex);
    setIsInsightsModalVisible(true);
  }, []);

  const handleMenuPress = useCallback((ex: Exercise) => {
    setContextMenuExercise(ex);
    setIsContextMenuVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseRow 
        exercise={item} 
        onPress={handleRowPress} 
        onMenuPress={handleMenuPress}
        exerciseNameLanguage={exerciseNameLanguage}
      />
    ),
    [handleRowPress, handleMenuPress, exerciseNameLanguage]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: AlphaSection }) => (
      <View style={styles.alphaHeader}>
        <Text style={styles.alphaLetter}>{section.letter}</Text>
        <View style={styles.alphaHeaderLine} />
      </View>
    ),
    []
  );

  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  // ── Stable getItemLayout ─────────────────────────────────────────────────────
  // The original implementation captured `sections` in a useMemo dep, causing
  // the layout calculator to be recreated on every filter/sort change — an
  // O(n) allocation during interactive scrolling. Instead, we keep a ref that
  // always points to the latest sections and produce a stable callback that is
  // created exactly once.
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const getItemLayout = useCallback(
    sectionListGetItemLayout({
      getItemHeight: (sectionIndex: number, itemIndex: number) =>
        sectionsRef.current[sectionIndex]?.data[itemIndex]?.notes ? 104 : 72,
      getSectionHeaderHeight: () => 48,
    }),
    [] // stable — never recreated
  );

  const handleAddSubmit = useCallback(() => {
    if (!newExName.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('exercises.enterExerciseName'));
      return;
    }
    if (onAddExercise) {
      onAddExercise(newExName.trim(), newExMuscle, newExEquipment, newExUnilateral);
      setNewExName('');
      setNewExMuscle('Chest');
      setNewExEquipment('Barbell');
      setNewExUnilateral(false);
      setNewExShowAdvanced(false);
      setIsAddModalVisible(false);
      showToast(i18n.t('exercises.customExerciseAdded', { name: newExName.trim() }), 'success');
    }
  }, [newExName, newExMuscle, newExEquipment, newExUnilateral, onAddExercise]);

  const handleEditSubmit = useCallback(() => {
    if (!editExName.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('exercises.enterExerciseName'));
      return;
    }
    if (onUpdateExercise) {
      onUpdateExercise(editExIdRef.current, editExName.trim(), editExMuscle, editExEquipment, editExUnilateral);
    }
  }, [editExName, editExMuscle, editExEquipment, editExUnilateral, onUpdateExercise]);

  const handleDeletePress = useCallback((ex: Exercise | string) => {
    const targetId = typeof ex === 'string' ? ex : ex.id;
    const targetName = typeof ex === 'string' ? (selectedExercise?.name || '') : ex.name;
    Alert.alert(
      i18n.t('exercises.deleteExercise'),
      i18n.t('exercises.deleteExerciseMsg', { name: targetName }),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (onDeleteExercise) {
              onDeleteExercise(targetId);
              setIsInsightsModalVisible(false);
              setSelectedExercise(null);
            }
          }
        }
      ]
    );
  }, [onDeleteExercise, selectedExercise]);

  const handleToggleSort = useCallback(() => {
    setSortMode(prev => {
      if (prev === 'alphabetical-asc') return 'alphabetical-desc';
      if (prev === 'alphabetical-desc') return 'sets';
      return 'alphabetical-asc';
    });
  }, []);

  const headerActions = useMemo(() => [
    { icon: 'add-outline' as const, label: i18n.t('exercises.add'), onPress: () => setIsAddModalVisible(true) },
    { icon: 'filter-outline' as const, label: i18n.t('exercises.filter'), onPress: () => setIsFilterBarVisible(prev => !prev), color: selectedMuscles.length > 0 ? colors.accent : colors.textPrimary },
    { icon: 'swap-vertical-outline' as const, label: i18n.t('exercises.sort'), onPress: handleToggleSort, color: sortMode !== 'alphabetical-asc' ? colors.highlight : colors.textPrimary },
  ], [selectedMuscles.length, sortMode]);

  const subtitle = useMemo(() => {
    const filtersActive = selectedMuscles.length > 0 || selectedEquipment.length > 0 || searchQuery.trim().length > 0;
    return filtersActive
      ? i18n.t('extras.foundResultsCount', { count: filteredExercises.length })
      : i18n.t('extras.totalMovements', { count: exercises.length });
  }, [exercises.length, filteredExercises.length, searchQuery, selectedMuscles, selectedEquipment]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={i18n.t('exercises.title')}
        subtitle={subtitle}
        actions={headerActions}
      />

      {/* Modern integrated Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={i18n.t('exercises.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            returnKeyType="search"
            testID="exercises.search"
            hitSlop={HIT_SLOP_12}
          />
          {searchQuery.length > 0 && (
            <IconButton
              name="close-circle"
              size={18}
              color={colors.textSecondary}
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear search"
              style={styles.clearSearchBtn}
            />
          )}
        </View>
      </View>

      {/* Filter Sub-menu (Popover) */}
      {isFilterBarVisible && (
        <View style={styles.popoverWrapper}>
          <Pressable
            style={styles.popoverBackdrop}
            onPress={() => setIsFilterBarVisible(false)}
          >
            <Pressable
              style={styles.popoverContainer}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View style={styles.popoverHeader}>
                <Text style={styles.popoverTitle}>{i18n.t('extras.filterExercises')}</Text>
                {(selectedMuscles.length > 0 || selectedEquipment.length > 0) && (
                  <Pressable onPress={handleClearFilters} style={styles.clearAllBtn}>
                    <Text style={styles.clearAllText}>{i18n.t('extras.clearAll')}</Text>
                  </Pressable>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.popoverScroll}>
                {/* Muscle Group Section */}
                <Text style={styles.popoverSectionTitle}>{i18n.t('extras.filterByMuscleGroup')}</Text>
                <View style={styles.popoverGrid}>
                  {MUSCLE_GROUPS.map(muscle => {
                    const isActive = selectedMuscles.includes(muscle);
                    const muscleColor = getMuscleColor(muscle);
                    return (
                      <Pressable
                        key={muscle}
                        onPress={() => handleToggleMuscle(muscle)}
                        style={[
                          styles.popoverChip,
                          isActive && {
                            backgroundColor: muscleColor + '15',
                            borderColor: muscleColor,
                          }
                        ]}
                      >
                        <View style={[styles.popoverDot, { backgroundColor: muscleColor }]} />
                        <Text style={[
                          styles.popoverChipText,
                          isActive && { color: colors.textPrimary, fontFamily: font.semibold }
                        ]}>
                          {getMuscleDisplayName(muscle, exerciseNameLanguage)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Equipment Section */}
                <Text style={styles.popoverSectionTitle}>{i18n.t('extras.filterByEquipment')}</Text>
                <View style={styles.popoverGrid}>
                  {EQUIPMENT_TYPES.map(eq => {
                    const isActive = selectedEquipment.includes(eq);
                    return (
                      <Pressable
                        key={eq}
                        onPress={() => handleToggleEquipment(eq)}
                        style={[
                          styles.popoverChip,
                          isActive && {
                            backgroundColor: colors.highlight + '15',
                            borderColor: colors.highlight,
                          }
                        ]}
                      >
                        <View style={[styles.popoverDot, { backgroundColor: colors.highlight }]} />
                        <Text style={[
                          styles.popoverChipText,
                          isActive && { color: colors.textPrimary, fontFamily: font.semibold }
                        ]}>
                          {eq}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Footer Action */}
              <Pressable
                style={styles.applyBtn}
                onPress={() => setIsFilterBarVisible(false)}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.applyBtnText}>
                  {i18n.t('extras.showResults', { count: filteredExercises.length })}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </View>
      )}

      {/* Exercises Section List — guarded by isDataReady to avoid painting
          the list during the navigation transition. The skeleton fills the gap
          with zero JS computation. */}
      <Animated.View style={animatedContainerStyle}>
        {!isDataReady ? (
          <SkeletonList />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            getItemLayout={getItemLayout}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            overScrollMode="never"
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            updateCellsBatchingPeriod={50}
            windowSize={5}
            testID="exercises.list"
          />
        )}
      </Animated.View>

      {/* Modal 1: Add Custom Exercise */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('extras.createExerciseTitle')}</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsAddModalVisible(false)}
              />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>{i18n.t('extras.exerciseNameLabel')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={i18n.t('extras.exerciseNamePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={newExName}
                onChangeText={setNewExName}
                keyboardAppearance="dark"
                maxLength={40}
              />

              <Text style={styles.inputLabel}>{i18n.t('extras.primaryMuscleGroup')}</Text>
              <View style={styles.gridContainer}>
                {MUSCLE_GROUPS.map(muscle => {
                  const isSelected = newExMuscle === muscle;
                  const muscleColor = getMuscleColor(muscle);
                  return (
                    <Pressable
                      key={muscle}
                      onPress={() => setNewExMuscle(muscle)}
                      style={[
                        styles.gridItem,
                        isSelected && {
                          backgroundColor: muscleColor + '20',
                          borderColor: muscleColor,
                        }
                      ]}
                    >
                      <Text style={[styles.gridItemText, isSelected && { color: colors.textPrimary, fontFamily: font.bold }]}>
                        {getMuscleDisplayName(muscle, exerciseNameLanguage).toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>EQUIPMENT TYPE</Text>
              <View style={styles.gridContainer}>
                {EQUIPMENT_TYPES.map(eq => {
                  const isSelected = newExEquipment === eq;
                  return (
                    <Pressable
                      key={eq}
                      onPress={() => setNewExEquipment(eq)}
                      style={[
                        styles.gridItem,
                        isSelected && {
                          backgroundColor: colors.accent + '20',
                          borderColor: colors.accent,
                        }
                      ]}
                    >
                      <Text style={[styles.gridItemText, isSelected && { color: colors.textPrimary, fontFamily: font.bold }]}>
                        {eq.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Advanced Settings Section */}
              <Pressable
                onPress={() => setNewExShowAdvanced(v => !v)}
                style={styles.advancedHeader}
                android_ripple={rippleTokens.surface}
              >
                <Text style={styles.advancedHeaderTitle}>ADVANCED SETTINGS</Text>
                <Ionicons
                  name={newExShowAdvanced ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>

              {newExShowAdvanced && (
                <View style={styles.advancedContent}>
                  <Text style={styles.inputLabel}>{i18n.t('extras.exerciseModeLabel')}</Text>
                  <View style={styles.gridContainer}>
                    <Pressable
                      onPress={() => setNewExUnilateral(false)}
                      style={[
                        styles.gridItem,
                        !newExUnilateral && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.gridItemText, !newExUnilateral && { color: colors.accent, fontFamily: font.bold }]}>
                        {i18n.t('extras.bilateralDefault')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setNewExUnilateral(true)}
                      style={[
                        styles.gridItem,
                        newExUnilateral && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.gridItemText, newExUnilateral && { color: colors.accent, fontFamily: font.bold }]}>
                        {i18n.t('extras.unilateralSingle')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <Pressable
                style={styles.submitBtn}
                onPress={handleAddSubmit}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.submitBtnText}>{i18n.t('extras.addExerciseBtn')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Edit Custom Exercise */}
      {isEditModalVisible && (
        <Modal
          visible={isEditModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsEditModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{i18n.t('extras.editExerciseTitle')}</Text>
                <IconButton
                  name="close"
                  size={22}
                  color={colors.textSecondary}
                  onPress={() => setIsEditModalVisible(false)}
                />
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <Text style={styles.inputLabel}>{i18n.t('extras.exerciseNameLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={i18n.t('extras.exerciseNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={editExName}
                  onChangeText={setEditExName}
                  keyboardAppearance="dark"
                  maxLength={40}
                />

                <Text style={styles.inputLabel}>{i18n.t('extras.primaryMuscleGroup')}</Text>
                <View style={styles.gridContainer}>
                  {MUSCLE_GROUPS.map(muscle => {
                    const isSelected = editExMuscle === muscle;
                    const muscleColor = getMuscleColor(muscle);
                    return (
                      <Pressable
                        key={muscle}
                        onPress={() => setEditExMuscle(muscle)}
                        style={[
                          styles.gridItem,
                          isSelected && {
                            backgroundColor: muscleColor + '20',
                            borderColor: muscleColor,
                          }
                        ]}
                      >
                        <Text style={[styles.gridItemText, isSelected && { color: colors.textPrimary, fontFamily: font.bold }]}>
                          {getMuscleDisplayName(muscle, exerciseNameLanguage).toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

              <Text style={styles.inputLabel}>{i18n.t('extras.equipmentType')}</Text>
                <View style={styles.gridContainer}>
                  {EQUIPMENT_TYPES.map(eq => {
                    const isSelected = editExEquipment === eq;
                    return (
                      <Pressable
                        key={eq}
                        onPress={() => setEditExEquipment(eq)}
                        style={[
                          styles.gridItem,
                          isSelected && {
                            backgroundColor: colors.accent + '20',
                            borderColor: colors.accent,
                          }
                        ]}
                      >
                        <Text style={[styles.gridItemText, isSelected && { color: colors.textPrimary, fontFamily: font.bold }]}>
                          {eq.toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Advanced Settings Section */}
                <Pressable
                  onPress={() => setEditExShowAdvanced(v => !v)}
                  style={styles.advancedHeader}
                  android_ripple={rippleTokens.surface}
                >
                <Text style={styles.advancedHeaderTitle}>{i18n.t('extras.advancedSettings')}</Text>
                  <Ionicons
                    name={editExShowAdvanced ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {editExShowAdvanced && (
                  <View style={styles.advancedContent}>
                    <Text style={styles.inputLabel}>{i18n.t('extras.exerciseModeLabel')}</Text>
                    <View style={styles.gridContainer}>
                      <Pressable
                        onPress={() => setEditExUnilateral(false)}
                        style={[
                          styles.gridItem,
                          !editExUnilateral && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                        ]}
                      >
                        <Text style={[styles.gridItemText, !editExUnilateral && { color: colors.accent, fontFamily: font.bold }]}>
                          {i18n.t('extras.bilateralDefault')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditExUnilateral(true)}
                        style={[
                          styles.gridItem,
                          editExUnilateral && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                        ]}
                      >
                        <Text style={[styles.gridItemText, editExUnilateral && { color: colors.accent, fontFamily: font.bold }]}>
                          {i18n.t('extras.unilateralSingle')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                <Pressable
                  style={styles.submitBtn}
                  onPress={handleEditSubmit}
                  android_ripple={rippleTokens.accent}
                >
                  <Text style={styles.submitBtnText}>{i18n.t('extras.saveChangesBtn')}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Exercise Info / Insights Modal */}
      {selectedExercise && (
        <ExerciseInsightsModal
          visible={isInsightsModalVisible}
          exerciseName={selectedExercise.name}
          exerciseLibraryEntry={selectedExercise}
          sessions={sessions}
          onClose={() => setIsInsightsModalVisible(false)}
          onUpdateExerciseInsightsNotes={onUpdateExerciseNotes}
          onUpdateExerciseVariations={onUpdateExerciseVariations}
          onDeleteExercise={handleDeletePress}
          exerciseNameLanguage={exerciseNameLanguage}
        />
      )}

      {/* Modal: Exercise Row 3-Dot Options */}
      {contextMenuExercise && (
        <Modal
          visible={isContextMenuVisible && contextMenuExercise !== null}
          animationType="fade"
          transparent
          onRequestClose={() => setIsContextMenuVisible(false)}
        >
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => setIsContextMenuVisible(false)}
          >
            <Pressable style={[styles.modalCard, { paddingVertical: spacing.md }]} onPress={(e) => e.stopPropagation()}>
              {contextMenuExercise && (
              <View>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>{contextMenuExercise.name.toUpperCase()}</Text>
                <IconButton
                  name="close"
                  size={22}
                  color={colors.textSecondary}
                  onPress={() => setIsContextMenuVisible(false)}
                />
              </View>

              <View style={{ rowGap: spacing.xs }}>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setIsContextMenuVisible(false);
                    setSelectedExercise(contextMenuExercise);
                    setIsInsightsModalVisible(true);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.accent} />
                  <Text style={styles.menuItemText}>
                    {contextMenuExercise.notes ? i18n.t('exercises.editNote') : i18n.t('exercises.addNote')}
                  </Text>
                </Pressable>

                {contextMenuExercise.notes ? (
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      Alert.alert(
                        i18n.t('exercises.clearNote'),
                        i18n.t('exercises.clearNoteMsg'),
                        [
                          { text: i18n.t('common.cancel'), style: 'cancel' },
                          {
                            text: i18n.t('exercises.clearNote'),
                            style: 'destructive',
                            onPress: () => {
                              if (onUpdateExerciseNotes) {
                                onUpdateExerciseNotes(contextMenuExercise.id, undefined);
                              }
                              setIsContextMenuVisible(false);
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <Text style={[styles.menuItemText, { color: colors.error }]}>{i18n.t('exercises.clearNote')}</Text>
                  </Pressable>
                ) : null}

                {contextMenuExercise.id.startsWith('ex-custom-') ? (
                  <>
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        editExIdRef.current = contextMenuExercise.id;
                        setEditExName(contextMenuExercise.name);
                        setEditExMuscle(contextMenuExercise.muscleGroup);
                        setEditExEquipment(contextMenuExercise.equipment || 'Other');
                        setEditExUnilateral(contextMenuExercise.isUnilateral || false);
                        setEditExShowAdvanced(false);
                        setIsContextMenuVisible(false);
                        setIsEditModalVisible(true);
                      }}
                    >
                      <Ionicons name="settings-outline" size={20} color={colors.accent} />
                      <Text style={styles.menuItemText}>{i18n.t('exercises.editExerciseConfig')}</Text>
                    </Pressable>

                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        setIsContextMenuVisible(false);
                        handleDeletePress(contextMenuExercise);
                      }}
                    >
                      <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
                      <Text style={[styles.menuItemText, { color: colors.error }]}>{i18n.t('exercises.deleteCustomExercise')}</Text>
                    </Pressable>
                  </>
                ) : null}
               </View>
              </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
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
    height:            46,
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
    paddingHorizontal: spacing.xs,
  },
  clearSearchBtn: {
    padding: 0,
    marginLeft: spacing.xs,
  },
  list: {
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  alphaHeader: {
    backgroundColor:   colors.bg,
    paddingHorizontal: spacing.lg,
    height:            HEADER_HEIGHT,
    flexDirection:     'row',
    alignItems:        'center',
    columnGap:         spacing.md,
  },
  alphaLetter: {
    color:      colors.accent,
    fontSize:   font.sizes.lg,
    fontFamily: font.bold,
  },
  alphaHeaderLine: {
    flex:            1,
    height:          1,
    backgroundColor: colors.border,
    marginTop:       2,
  },
  rowOuter: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.bg,
  },
  rowContainer: {
    minHeight:         ITEM_HEIGHT,
    justifyContent:    'center',
  },
  notesContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.md,
  },
  thumb: {
    width:          44,
    height:         44,
    borderRadius:   radius.sm,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  thumbText: {
    fontSize:   font.sizes.base,
    fontFamily: font.bold,
  },
  rowCenter: {
    flex: 1,
  },
  exerciseName: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.semibold,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeDot: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    marginHorizontal: 5,
  },
  equipmentBadge: {
    fontSize:      font.sizes.xs,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },
  muscleGroup: {
    fontSize:      font.sizes.xs,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  weeklySets: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.bold,
  },
  setsLabel: {
    color:         colors.textSecondary,
    fontSize:      9,
    fontFamily:    font.bold,
    letterSpacing: 0.5,
    marginTop:     1,
  },
  notesToggle: {
    marginTop: spacing.xs,
  },
  rowRightInner: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  setsInfo: {
    alignItems: 'flex-end',
  },
  menuBtn: {
    padding: spacing.xs,
  },
  trendContainer: {
    rowGap: spacing.sm,
    marginTop: spacing.sm,
    width: '100%',
  },
  detailsScrollContent: {
    paddingBottom: spacing.lg,
  },
  detailsNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Popover / Sub-menu Filters
  popoverWrapper: {
    position: 'absolute',
    top: 70, // Anchored below the header bar so top nav remains visible
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999, // Render on top of flat list
  },
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.65)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  popoverContainer: {
    width: '100%',
    maxHeight: '70%', // Approximately 60-70% of screen height
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...(shadow.lg as object),
  },
  popoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  popoverTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
  },
  clearAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  clearAllText: {
    color: colors.error,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  popoverScroll: {
    rowGap: spacing.md,
    paddingBottom: spacing.md,
  },
  popoverSectionTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs - 1,
    fontFamily: font.bold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  popoverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  popoverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    columnGap: 6,
  },
  popoverChipText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
  },
  popoverDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  applyBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  applyBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },

  // Modals Styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    maxHeight: '90%',
    ...(shadow.lg as object),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  modalScroll: {
    rowGap: spacing.md,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    padding: spacing.md,
    fontSize: font.sizes.md,
    fontFamily: font.medium,
  },

  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  gridItem: {
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28%',
    flexGrow: 1,
  },
  gridItemText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.semibold,
  },

  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...(shadow.accentGlow as object),
  },
  submitBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  advancedHeaderTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  advancedContent: {
    paddingVertical: spacing.md,
    rowGap: spacing.sm,
  },

  // Details Modal
  detailsCard: {
    alignItems: 'stretch',
  },
  detailsContent: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    rowGap: spacing.md,
  },
  detailsHeaderCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  detailsName: {
    color: colors.textPrimary,
    fontSize: font.sizes.xl,
    fontFamily: font.bold,
    textAlign: 'center',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  detailsBadge: {
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },
  detailsBadgeText: {
    fontSize: font.sizes.xs - 1,
    fontFamily: font.bold,
    letterSpacing: 0.8,
  },
  detailsStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    borderColor: colors.border,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
    marginVertical: spacing.xs,
  },
  detailsStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  detailsStatValue: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
  },
  detailsStatLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.semibold,
    marginTop: 4,
  },
  detailsStatDivider: {
    width: 1,
    height: 35,
    backgroundColor: colors.border,
  },
  deleteExBtn: {
    flexDirection: 'row',
    columnGap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.error + '40',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.error + '08',
  },
  deleteExBtnText: {
    color: colors.error,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  lockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    marginTop: spacing.xs,
  },
  lockInfoText: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
  },

  // Expanded details styling
  detailsNoteContainer: {
    width: '100%',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  detailsNoteText: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    fontFamily: font.medium,
  },
  detailsNoteEmptyText: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    fontFamily: font.regular,
  },
  editNoteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  editNoteLinkText: {
    color: colors.accent,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  detailsSection: {
    width: '100%',
    marginVertical: spacing.xs,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    height: 36,
  },
  trendDate: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    width: 48,
  },
  trendBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  trendBar: {
    height: '100%',
    borderRadius: radius.full,
  },
  trendWeight: {
    color: colors.textPrimary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    textAlign: 'right',
  },
  trendValueContainer: {
    alignItems: 'flex-end',
    width: 90,
  },
  trendSubtext: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: font.medium,
    marginTop: 1,
  },
  prTable: {
    width: '100%',
    marginTop: spacing.xs,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  prTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prTableHeaderText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  prTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  prTableText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
  },
  prRank: {
    color: colors.highlight,
    fontFamily: font.bold,
  },
  prTableWeight: {
    color: colors.textPrimary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  menuItem: {
    flexDirection: 'row',
    columnGap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderColor: colors.border,
    borderBottomWidth: 1,
  },
  menuItemText: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: colors.textInverse,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  noteModalHeader: {
    color: colors.accent,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  noteSubtitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontStyle: 'italic',
    marginTop: 2,
    fontFamily: font.regular,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Styles — AMOLED-safe, zero-allocation
// ─────────────────────────────────────────────────────────────────────────────
const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  sectionHeader: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    columnGap: spacing.md,
    backgroundColor: colors.bg,
  },
  sectionLetter: {
    width: 18,
    height: 18,
    borderRadius: radius.xs ?? 3,
    backgroundColor: colors.surface2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surface2,
  },
  row: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    columnGap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  center: {
    flex: 1,
    rowGap: 8,
  },
  lineLong: {
    height: 12,
    width: '72%',
    borderRadius: radius.xs ?? 3,
    backgroundColor: colors.surface2,
  },
  lineShort: {
    height: 10,
    width: '45%',
    borderRadius: radius.xs ?? 3,
    backgroundColor: colors.surface,
  },
  right: {
    alignItems: 'flex-end',
    rowGap: 4,
  },
  pill: {
    width: 28,
    height: 28,
    borderRadius: radius.xs ?? 3,
    backgroundColor: colors.surface2,
  },
});

const tagStyles = StyleSheet.create({
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 142, 247, 0.15)',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    color: colors.accent,
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    columnGap: spacing.xs,
  },
  addTagInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    color: colors.textPrimary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  addTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  addTagBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    marginLeft: 2,
  },
});

export default React.memo(ExercisesScreen);
