// screens/ExercisesScreen.tsx
import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens } from '../theme';
import { Exercise } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import PressableRow from '../components/ui/PressableRow';
import IconButton   from '../components/ui/IconButton';

const ITEM_HEIGHT   = 72;
const HEADER_HEIGHT = 48;

interface ExercisesScreenProps {
  exercises: Exercise[];
}

interface AlphaSection {
  letter: string;
  data:   Exercise[];
}

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
  return colors.muscle.default;
};

const ExerciseRow: React.FC<{ exercise: Exercise }> = React.memo(({ exercise }) => {
  const muscleColor = getMuscleColor(exercise.muscleGroup);

  return (
    <PressableRow
      onPress={() => {}}
      style={styles.rowContainer}
      padding={{ vertical: spacing.md, horizontal: spacing.lg }}
      testID={`exercises.exercise.${exercise.id}`}
      accessibilityLabel={`${exercise.name}, ${exercise.muscleGroup}, ${exercise.weeklySets} sets per week`}
    >
      <View style={styles.rowContent}>
        {/* Dynamic color-coded muscle group indicator */}
        <View style={[
          styles.thumb,
          {
            backgroundColor: muscleColor + '12',
            borderColor:     muscleColor + '40',
          }
        ]}>
          <Text style={[styles.thumbText, { color: muscleColor }]}>
            {exercise.muscleGroup[0].toUpperCase()}
          </Text>
        </View>

        <View style={styles.rowCenter}>
          <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
          <View style={styles.badgeContainer}>
            <Text style={[styles.muscleGroup, { color: muscleColor }]}>
              {exercise.muscleGroup.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.weeklySets}>{exercise.weeklySets}</Text>
          <Text style={styles.setsLabel}>SETS/WK</Text>
        </View>
      </View>
    </PressableRow>
  );
});

const ExercisesScreen: React.FC<ExercisesScreenProps> = ({ exercises }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter exercises based on search query
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const query = searchQuery.toLowerCase().trim();
    return exercises.filter(
      ex =>
        ex.name.toLowerCase().includes(query) ||
        ex.muscleGroup.toLowerCase().includes(query)
    );
  }, [exercises, searchQuery]);

  // 2. Group into alphabetical sections
  const sections: AlphaSection[] = useMemo(() => {
    const sorted = [...filteredExercises].sort((a, b) => a.name.localeCompare(b.name));
    const map    = new Map<string, Exercise[]>();
    for (const ex of sorted) {
      const letter = ex.name[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(ex);
    }
    return Array.from(map.entries()).map(([letter, data]) => ({ letter, data }));
  }, [filteredExercises]);

  const getItemLayout = useCallback(
    (_: AlphaSection[] | null, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => <ExerciseRow exercise={item} />,
    []
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

  const headerActions = useMemo(() => [
    { icon: 'filter-outline' as const, label: 'Filter', onPress: () => {} },
    { icon: 'swap-vertical-outline' as const, label: 'Sort', onPress: () => {} },
  ], []);

  const subtitle = useMemo(() => {
    return searchQuery.trim()
      ? `Found ${filteredExercises.length} results`
      : `${exercises.length} total movements`;
  }, [exercises.length, filteredExercises.length, searchQuery]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Exercises"
        subtitle={subtitle}
        actions={headerActions}
      />

      {/* Modern integrated Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercise or muscle..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            returnKeyType="search"
            testID="exercises.search"
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
        maxToRenderPerBatch={12}
        windowSize={15}
        initialNumToRender={14}
        testID="exercises.list"
      />
    </SafeAreaView>
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
    paddingVertical: 0, // important for center alignment on Android
  },
  clearSearchBtn: {
    padding: 0,
    marginLeft: spacing.xs,
  },
  list: {
    paddingBottom: spacing.xxxl + spacing.lg, // Account for BottomTabBar and spacing
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
  rowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.bg,
    height:            ITEM_HEIGHT,
    justifyContent:    'center',
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
    alignSelf: 'flex-start',
    marginTop: 2,
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
});

export default ExercisesScreen;
