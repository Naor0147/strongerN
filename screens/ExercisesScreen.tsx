// screens/ExercisesScreen.tsx
import React, { useMemo, useCallback, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
import { Exercise } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import PressableRow from '../components/ui/PressableRow';
import IconButton   from '../components/ui/IconButton';

const ITEM_HEIGHT   = 72;
const HEADER_HEIGHT = 48;

interface ExercisesScreenProps {
  exercises: Exercise[];
  onAddExercise?: (name: string, muscleGroup: string) => void;
  onDeleteExercise?: (id: string) => void;
}

interface AlphaSection {
  letter: string;
  data:   Exercise[];
}

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps', 'Glutes', 'Rear Delts'
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
  return colors.muscle.default;
};

const ExerciseRow: React.FC<{ exercise: Exercise; onPress: (ex: Exercise) => void }> = React.memo(({ exercise, onPress }) => {
  const muscleColor = getMuscleColor(exercise.muscleGroup);

  return (
    <PressableRow
      onPress={() => onPress(exercise)}
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

const ExercisesScreen: React.FC<ExercisesScreenProps> = ({ exercises, onAddExercise, onDeleteExercise }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'alphabetical-asc' | 'alphabetical-desc' | 'sets'>('alphabetical-asc');
  const [isFilterBarVisible, setIsFilterBarVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // New Exercise Form States
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('Chest');

  // Toggle muscle filter
  const handleToggleMuscle = (muscle: string) => {
    setSelectedMuscles(prev =>
      prev.includes(muscle)
        ? prev.filter(m => m !== muscle)
        : [...prev, muscle]
    );
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedMuscles([]);
    setSearchQuery('');
  };

  // 1. Filter exercises based on search query & active muscles
  const filteredExercises = useMemo(() => {
    let result = exercises;

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        ex =>
          ex.name.toLowerCase().includes(query) ||
          ex.muscleGroup.toLowerCase().includes(query)
      );
    }

    // Muscle groups filter
    if (selectedMuscles.length > 0) {
      result = result.filter(ex => selectedMuscles.includes(ex.muscleGroup));
    }

    return result;
  }, [exercises, searchQuery, selectedMuscles]);

  // 2. Sort exercises
  const sortedExercises = useMemo(() => {
    const result = [...filteredExercises];
    if (sortMode === 'alphabetical-asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'alphabetical-desc') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortMode === 'sets') {
      result.sort((a, b) => b.weeklySets - a.weeklySets || a.name.localeCompare(b.name));
    }
    return result;
  }, [filteredExercises, sortMode]);

  // 3. Group into sections
  const sections: AlphaSection[] = useMemo(() => {
    if (sortMode === 'sets') {
      // If sorted by sets, we group by "Weekly Sets Range"
      const map = new Map<string, Exercise[]>();
      for (const ex of sortedExercises) {
        let label = '0 Sets';
        if (ex.weeklySets > 12) label = 'High Volume (13+ sets)';
        else if (ex.weeklySets > 8) label = 'Moderate Volume (9-12 sets)';
        else if (ex.weeklySets > 0) label = 'Low Volume (1-8 sets)';
        
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
    setIsDetailsModalVisible(true);
  }, []);

  const getItemLayout = useCallback(
    (_: AlphaSection[] | null, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => <ExerciseRow exercise={item} onPress={handleRowPress} />,
    [handleRowPress]
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

  const handleAddSubmit = () => {
    if (!newExName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name.');
      return;
    }
    if (onAddExercise) {
      onAddExercise(newExName.trim(), newExMuscle);
      setNewExName('');
      setIsAddModalVisible(false);
      Alert.alert('Success', `Custom exercise "${newExName.trim()}" added!`);
    }
  };

  const handleDeletePress = (ex: Exercise) => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete your custom exercise "${ex.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDeleteExercise) {
              onDeleteExercise(ex.id);
              setIsDetailsModalVisible(false);
              setSelectedExercise(null);
            }
          }
        }
      ]
    );
  };

  const handleToggleSort = () => {
    setSortMode(prev => {
      if (prev === 'alphabetical-asc') return 'alphabetical-desc';
      if (prev === 'alphabetical-desc') return 'sets';
      return 'alphabetical-asc';
    });
  };

  const headerActions = useMemo(() => [
    { icon: 'add-outline' as const, label: 'Add', onPress: () => setIsAddModalVisible(true) },
    { icon: 'filter-outline' as const, label: 'Filter', onPress: () => setIsFilterBarVisible(prev => !prev), color: selectedMuscles.length > 0 ? colors.accent : colors.textPrimary },
    { icon: 'swap-vertical-outline' as const, label: 'Sort', onPress: handleToggleSort, color: sortMode !== 'alphabetical-asc' ? colors.highlight : colors.textPrimary },
  ], [selectedMuscles.length, sortMode]);

  const subtitle = useMemo(() => {
    const filtersActive = selectedMuscles.length > 0 || searchQuery.trim().length > 0;
    return filtersActive
      ? `Found ${filteredExercises.length} results`
      : `${exercises.length} total movements`;
  }, [exercises.length, filteredExercises.length, searchQuery, selectedMuscles]);

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

      {/* Dynamic Muscle Group Filters Panel */}
      {isFilterBarVisible && (
        <View style={styles.filterBarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {selectedMuscles.length > 0 && (
              <Pressable
                onPress={handleClearFilters}
                style={[styles.filterChip, styles.clearChip]}
              >
                <Text style={styles.clearChipText}>Clear All</Text>
              </Pressable>
            )}
            {MUSCLE_GROUPS.map(muscle => {
              const isActive = selectedMuscles.includes(muscle);
              const muscleColor = getMuscleColor(muscle);
              return (
                <Pressable
                  key={muscle}
                  onPress={() => handleToggleMuscle(muscle)}
                  style={[
                    styles.filterChip,
                    isActive && {
                      backgroundColor: muscleColor + '20',
                      borderColor: muscleColor,
                    }
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: muscleColor }]} />
                  <Text style={[styles.filterChipText, isActive && { color: colors.textPrimary, fontFamily: font.semibold }]}>
                    {muscle}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Exercises Section List */}
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
              <Text style={styles.modalTitle}>CREATE EXERCISE</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsAddModalVisible(false)}
              />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>EXERCISE NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Incline Dumbbell Press"
                placeholderTextColor={colors.textMuted}
                value={newExName}
                onChangeText={setNewExName}
                keyboardAppearance="dark"
                maxLength={40}
              />

              <Text style={styles.inputLabel}>PRIMARY MUSCLE GROUP</Text>
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
                        {muscle.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.submitBtn}
                onPress={handleAddSubmit}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.submitBtnText}>ADD EXERCISE</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Exercise Details */}
      {selectedExercise && (
        <Modal
          visible={isDetailsModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setIsDetailsModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.detailsCard]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>EXERCISE INFO</Text>
                <IconButton
                  name="close"
                  size={22}
                  color={colors.textSecondary}
                  onPress={() => setIsDetailsModalVisible(false)}
                />
              </View>

              <View style={styles.detailsContent}>
                <View style={[
                  styles.detailsHeaderCircle,
                  { backgroundColor: getMuscleColor(selectedExercise.muscleGroup) + '15' }
                ]}>
                  <Ionicons name="barbell" size={40} color={getMuscleColor(selectedExercise.muscleGroup)} />
                </View>

                <Text style={styles.detailsName}>{selectedExercise.name}</Text>
                
                <View style={[
                  styles.detailsBadge,
                  { backgroundColor: getMuscleColor(selectedExercise.muscleGroup) + '22' }
                ]}>
                  <Text style={[styles.detailsBadgeText, { color: getMuscleColor(selectedExercise.muscleGroup) }]}>
                    {selectedExercise.muscleGroup.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.detailsStatsRow}>
                  <View style={styles.detailsStatBox}>
                    <Text style={styles.detailsStatValue}>{selectedExercise.weeklySets}</Text>
                    <Text style={styles.detailsStatLabel}>WEEKLY SETS</Text>
                  </View>
                  <View style={styles.detailsStatDivider} />
                  <View style={styles.detailsStatBox}>
                    <Text style={styles.detailsStatValue}>
                      {selectedExercise.id.startsWith('ex-custom-') ? 'CUSTOM' : 'SYSTEM'}
                    </Text>
                    <Text style={styles.detailsStatLabel}>SOURCE</Text>
                  </View>
                </View>

                {selectedExercise.id.startsWith('ex-custom-') ? (
                  <Pressable
                    style={styles.deleteExBtn}
                    onPress={() => handleDeletePress(selectedExercise)}
                    android_ripple={rippleTokens.borderless}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={styles.deleteExBtnText}>DELETE EXERCISE</Text>
                  </Pressable>
                ) : (
                  <View style={styles.lockInfo}>
                    <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.lockInfoText}>Standard gym movement (locked)</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    paddingVertical: 0,
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

  // Filters Bar
  filterBarContainer: {
    backgroundColor: colors.bg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    columnGap: spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    columnGap: 6,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  clearChip: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  clearChipText: {
    color: colors.textInverse,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
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

  // Details Modal
  detailsCard: {
    alignItems: 'stretch',
  },
  detailsContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
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
  detailsBadge: {
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },
  detailsBadgeText: {
    fontSize: font.sizes.xs,
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
    marginVertical: spacing.md,
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
});

export default ExercisesScreen;
