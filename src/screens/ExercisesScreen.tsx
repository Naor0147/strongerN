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
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../theme';
import { Exercise } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import PressableRow from '../components/ui/PressableRow';
import IconButton   from '../components/ui/IconButton';
import { sectionListGetItemLayout } from '../utils/listLayout';
import { translateExerciseName } from '../utils/i18n';

const ITEM_HEIGHT   = 72;
const HEADER_HEIGHT = 48;

interface ExercisesScreenProps {
  exercises: Exercise[];
  onAddExercise?: (name: string, muscleGroup: string, equipment: string) => void;
  onDeleteExercise?: (id: string) => void;
  onUpdateExerciseNotes?: (id: string, notes?: string) => void;
  sessions?: any[];
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

const ExerciseRow: React.FC<{
  exercise: Exercise;
  onPress: (ex: Exercise) => void;
  onMenuPress: (ex: Exercise) => void;
}> = React.memo(({ exercise, onPress, onMenuPress }) => {
  const muscleColor = getMuscleColor(exercise.muscleGroup);
  const [expanded, setExpanded] = useState(false);

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
          <Text style={styles.exerciseName} numberOfLines={1}>{translateExerciseName(exercise.name)}</Text>
          <View style={styles.badgeContainer}>
            <Text style={[styles.muscleGroup, { color: muscleColor }]}>
              {exercise.muscleGroup.toUpperCase()}
            </Text>
            <Text style={styles.badgeDot}>•</Text>
            <Text style={[styles.equipmentBadge, { color: colors.highlight }]}>
              {(exercise.equipment || 'Other').toUpperCase()}
            </Text>
          </View>
          {exercise.notes ? (
            <Pressable onPress={() => setExpanded(!expanded)} style={{ marginTop: spacing.xs }}>
              <Text style={styles.noteSubtitle} numberOfLines={expanded ? undefined : 2}>
                {exercise.notes}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.rowRight}>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.weeklySets}>{exercise.weeklySets}</Text>
              <Text style={styles.setsLabel}>SETS/WK</Text>
            </View>
            <IconButton
              name="ellipsis-horizontal"
              size={18}
              color={colors.textSecondary}
              onPress={() => onMenuPress(exercise)}
              accessibilityLabel="Exercise options"
              style={{ padding: spacing.xs }}
            />
          </View>
        </View>
      </View>
    </PressableRow>
  );
});

const ExercisesScreen: React.FC<ExercisesScreenProps> = ({ 
  exercises, 
  onAddExercise, 
  onDeleteExercise, 
  onUpdateExerciseNotes,
  sessions = [] 
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'alphabetical-asc' | 'alphabetical-desc' | 'sets'>('alphabetical-asc');
  const [isFilterBarVisible, setIsFilterBarVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [selectedExerciseState, setSelectedExercise] = useState<Exercise | null>(null);

  const enrichedExercises = useMemo(() => {
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
        allTimeSets: allTimeCounts[exKey] || 0,
      };
    });
  }, [exercises, sessions]);

  const selectedExercise = useMemo(() => {
    if (!selectedExerciseState) return null;
    return enrichedExercises.find(e => e.id === selectedExerciseState.id) || selectedExerciseState;
  }, [selectedExerciseState, enrichedExercises]);

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

  // Exercise history and PRs memos
  const exerciseHistory = useMemo(() => {
    if (!selectedExercise) return [];
    const history: { weight: number; reps: number; date: string; volume: number; estimated1RM: number }[] = [];
    (sessions || []).forEach(session => {
      const performed = (session.exercises || []).find(
        (ex: any) => ex.name.toLowerCase() === selectedExercise.name.toLowerCase()
      );
      if (performed) {
        const d = new Date(session.datetime);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${monthNames[d.getMonth()]} ${d.getDate()}`;
        const setsCount = performed.sets || 3;
        const weight = performed.bestWeight || 0;
        const reps = performed.bestReps || 0;
        
        // Epley 1RM Formula: Weight * (1 + Reps / 30)
        const est1RM = reps > 1 ? Math.round(weight * (1 + reps / 30) * 10) / 10 : weight;

        history.push({
          weight,
          reps,
          date: dateStr,
          volume: weight * reps * setsCount,
          estimated1RM: est1RM,
        });
      }
    });
    return history.reverse(); // Chronological order
  }, [selectedExercise, sessions]);

  const exercisePRs = useMemo(() => {
    if (exerciseHistory.length === 0) return [];
    // Sort descending by weight
    const sorted = [...exerciseHistory].sort((a, b) => b.weight - a.weight);
    // Keep top 3 unique by weight
    const uniqueWeights = new Map<number, typeof sorted[number]>();
    sorted.forEach(item => {
      if (!uniqueWeights.has(item.weight)) {
        uniqueWeights.set(item.weight, item);
      }
    });
    return Array.from(uniqueWeights.values()).slice(0, 3);
  }, [exerciseHistory]);

  // Toggle muscle filter
  const handleToggleMuscle = (muscle: string) => {
    setSelectedMuscles(prev =>
      prev.includes(muscle)
        ? prev.filter(m => m !== muscle)
        : [...prev, muscle]
    );
  };

  // Toggle equipment filter
  const handleToggleEquipment = (eq: string) => {
    setSelectedEquipment(prev =>
      prev.includes(eq)
        ? prev.filter(e => e !== eq)
        : [...prev, eq]
    );
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedMuscles([]);
    setSelectedEquipment([]);
    setSearchQuery('');
  };

  // 1. Filter exercises based on search query, active muscles, and active equipment
  const filteredExercises = useMemo(() => {
    let result = enrichedExercises;

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        ex =>
          ex.name.toLowerCase().includes(query) ||
          ex.muscleGroup.toLowerCase().includes(query) ||
          ex.equipment?.toLowerCase().includes(query)
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
      />
    ),
    [handleRowPress, handleMenuPress]
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

  const layoutCache = useMemo(() => {
    const cache: { length: number; offset: number; index: number }[] = [];
    let offset = 0;
    let flatIndex = 0;

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      // 1. Section Header
      const headerHeight = 48;
      cache[flatIndex] = { length: headerHeight, offset, index: flatIndex };
      offset += headerHeight;
      flatIndex++;

      // 2. Section Items
      const section = sections[sectionIndex];
      const itemsCount = section.data ? section.data.length : 0;
      for (let itemIndex = 0; itemIndex < itemsCount; itemIndex++) {
        const item = section.data[itemIndex];
        const itemHeight = item?.notes ? 72 + 32 : 72;
        cache[flatIndex] = { length: itemHeight, offset, index: flatIndex };
        offset += itemHeight;
        flatIndex++;
      }
    }
    return cache;
  }, [sections]);

  const getItemLayout = useCallback((data: any, index: number) => {
    if (layoutCache[index]) {
      return layoutCache[index];
    }
    return { length: 0, offset: 0, index };
  }, [layoutCache]);

  const handleAddSubmit = () => {
    if (!newExName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name.');
      return;
    }
    if (onAddExercise) {
      onAddExercise(newExName.trim(), newExMuscle, newExEquipment);
      setNewExName('');
      setNewExMuscle('Chest');
      setNewExEquipment('Barbell');
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
    const filtersActive = selectedMuscles.length > 0 || selectedEquipment.length > 0 || searchQuery.trim().length > 0;
    return filtersActive
      ? `Found ${filteredExercises.length} results`
      : `${exercises.length} total movements`;
  }, [exercises.length, filteredExercises.length, searchQuery, selectedMuscles, selectedEquipment]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
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
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
                <Text style={styles.popoverTitle}>Filter Exercises</Text>
                {(selectedMuscles.length > 0 || selectedEquipment.length > 0) && (
                  <Pressable onPress={handleClearFilters} style={styles.clearAllBtn}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </Pressable>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.popoverScroll}>
                {/* Muscle Group Section */}
                <Text style={styles.popoverSectionTitle}>FILTER BY MUSCLE GROUP</Text>
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
                          {muscle}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Equipment Section */}
                <Text style={styles.popoverSectionTitle}>FILTER BY EQUIPMENT</Text>
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
                  Show {filteredExercises.length} Results
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </View>
      )}

      {/* Exercises Section List */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
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
          animationType="slide"
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

              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: spacing.lg }}
              >
                <View style={styles.detailsContent}>
                  <View style={[
                    styles.detailsHeaderCircle,
                    { backgroundColor: getMuscleColor(selectedExercise.muscleGroup) + '15' }
                  ]}>
                    <Ionicons name="barbell" size={40} color={getMuscleColor(selectedExercise.muscleGroup)} />
                  </View>

                  <Text style={styles.detailsName}>{translateExerciseName(selectedExercise.name)}</Text>
                  
                  <View style={styles.badgesRow}>
                    <View style={[
                      styles.detailsBadge,
                      { backgroundColor: getMuscleColor(selectedExercise.muscleGroup) + '22' }
                    ]}>
                      <Text style={[styles.detailsBadgeText, { color: getMuscleColor(selectedExercise.muscleGroup) }]}>
                        {selectedExercise.muscleGroup.toUpperCase()}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.detailsBadge,
                      { backgroundColor: colors.highlight + '15' }
                    ]}>
                      <Text style={[styles.detailsBadgeText, { color: colors.highlight }]}>
                        {getSecondaryMuscles(selectedExercise.muscleGroup).toUpperCase()}
                      </Text>
                    </View>

                    <View style={[
                      styles.detailsBadge,
                      { backgroundColor: colors.highlight + '15' }
                    ]}>
                      <Text style={[styles.detailsBadgeText, { color: colors.highlight }]}>
                        {(selectedExercise.equipment || 'Other').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailsStatsRow}>
                    <View style={styles.detailsStatBox}>
                      <Text style={styles.detailsStatValue}>{selectedExercise.weeklySets}</Text>
                      <Text style={styles.detailsStatLabel}>WEEKLY SETS</Text>
                    </View>
                    <View style={styles.detailsStatDivider} />
                    <View style={styles.detailsStatBox}>
                      <Text style={styles.detailsStatValue}>
                        {(selectedExercise as any).allTimeSets || 0}
                      </Text>
                      <Text style={styles.detailsStatLabel}>ALL-TIME SETS</Text>
                    </View>
                  </View>

                  {/* Custom Note Indicator inside Details */}
                  <View style={styles.detailsNoteContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.sectionTitle}>MY EXERCISE NOTES</Text>
                      <Pressable 
                        onPress={() => {
                          setIsDetailsModalVisible(false);
                          setNoteEditExercise(selectedExercise);
                          setNoteText(selectedExercise.notes || '');
                          setIsNoteModalVisible(true);
                        }}
                        style={styles.editNoteLink}
                      >
                        <Ionicons name="create-outline" size={14} color={colors.accent} />
                        <Text style={styles.editNoteLinkText}>Edit</Text>
                      </Pressable>
                    </View>
                    {selectedExercise.notes ? (
                      <Text style={styles.detailsNoteText}>{selectedExercise.notes}</Text>
                    ) : (
                      <Text style={styles.detailsNoteEmptyText}>No custom cues or notes added. Tap Edit to add advice for seats, angles, or rest!</Text>
                    )}
                  </View>

                  {/* Progression Trend Chart */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>PROGRESSION TREND (ESTIMATED 1RM)</Text>
                    {exerciseHistory.length > 0 ? (
                      <View style={{ rowGap: spacing.sm, marginTop: spacing.sm, width: '100%' }}>
                        {(() => {
                          const last5 = exerciseHistory.slice(-5);
                          const max1RM = Math.max(...exerciseHistory.map(h => h.estimated1RM || h.weight), 1);
                          return last5.map((historyItem: any, idx) => {
                            const val1RM = historyItem.estimated1RM || historyItem.weight;
                            const percentage = max1RM > 0 ? (val1RM / max1RM) * 100 : 0;
                            return (
                              <View key={idx} style={styles.trendRow}>
                                <Text style={styles.trendDate}>{historyItem.date}</Text>
                                <View style={styles.trendBarContainer}>
                                  <View style={[styles.trendBar, { width: `${Math.max(15, percentage)}%` }]}>
                                    <LinearGradient
                                      colors={[colors.highlight, colors.accent]}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 0 }}
                                      style={StyleSheet.absoluteFill}
                                    />
                                  </View>
                                </View>
                                <View style={styles.trendValueContainer}>
                                  <Text style={styles.trendWeight}>
                                    {val1RM} kg
                                  </Text>
                                  <Text style={styles.trendSubtext}>
                                    {historyItem.weight} kg x {historyItem.reps}
                                  </Text>
                                </View>
                              </View>
                            );
                          });
                        })()}
                      </View>
                    ) : (
                      <Text style={styles.emptyText}>No workout sessions logged for this exercise yet.</Text>
                    )}
                  </View>

                  {/* Top 3 PRs Table */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>PERSONAL RECORDS (TOP LIFTS)</Text>
                    {exercisePRs.length > 0 ? (
                      <View style={styles.prTable}>
                        <View style={styles.prTableHeader}>
                          <Text style={[styles.prTableHeaderText, { width: '15%' }]}>#</Text>
                          <Text style={[styles.prTableHeaderText, { width: '35%' }]}>WEIGHT</Text>
                          <Text style={[styles.prTableHeaderText, { width: '25%' }]}>REPS</Text>
                          <Text style={[styles.prTableHeaderText, { width: '25%', textAlign: 'right' }]}>DATE</Text>
                        </View>
                        {exercisePRs.map((pr, idx) => (
                          <View key={idx} style={styles.prTableRow}>
                            <Text style={[styles.prTableText, styles.prRank, { width: '15%' }]}>
                              {idx + 1}
                            </Text>
                            <Text style={[styles.prTableWeight, { width: '35%' }]}>
                              {pr.weight} kg
                            </Text>
                            <Text style={[styles.prTableText, { width: '25%' }]}>
                              {pr.reps} reps
                            </Text>
                            <Text style={[styles.prTableText, { width: '25%', textAlign: 'right' }]}>
                              {pr.date}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyText}>Perform this movement in a workout to capture PR records.</Text>
                    )}
                  </View>

                  {selectedExercise.id.startsWith('ex-custom-') ? (
                    <Pressable
                      style={[styles.deleteExBtn, { marginTop: spacing.md }]}
                      onPress={() => handleDeletePress(selectedExercise)}
                      android_ripple={rippleTokens.borderless}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                      <Text style={styles.deleteExBtnText}>DELETE EXERCISE</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.lockInfo, { marginTop: spacing.md }]}>
                      <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.lockInfoText}>Standard gym movement (locked)</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal: Exercise Row 3-Dot Options */}
      {contextMenuExercise && (
        <Modal
          visible={isContextMenuVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setIsContextMenuVisible(false)}
        >
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => setIsContextMenuVisible(false)}
          >
            <Pressable style={[styles.modalCard, { paddingVertical: spacing.md }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>{translateExerciseName(contextMenuExercise.name).toUpperCase()}</Text>
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
                    setNoteEditExercise(contextMenuExercise);
                    setNoteText(contextMenuExercise.notes || '');
                    setIsNoteModalVisible(true);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.accent} />
                  <Text style={styles.menuItemText}>
                    {contextMenuExercise.notes ? 'Edit Note' : 'Add Note'}
                  </Text>
                </Pressable>

                {contextMenuExercise.notes ? (
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      Alert.alert(
                        'Clear Note',
                        'Are you sure you want to delete this note?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Clear Note',
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
                    <Text style={[styles.menuItemText, { color: colors.error }]}>Clear Note</Text>
                  </Pressable>
                ) : null}

                {contextMenuExercise.id.startsWith('ex-custom-') ? (
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      setIsContextMenuVisible(false);
                      handleDeletePress(contextMenuExercise);
                    }}
                  >
                    <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
                    <Text style={[styles.menuItemText, { color: colors.error }]}>Delete Custom Exercise</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Modal: Add/Edit Custom Note */}
      {noteEditExercise && (
        <Modal
          visible={isNoteModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsNoteModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {noteEditExercise.notes ? 'EDIT NOTE' : 'ADD NOTE'}
                </Text>
                <IconButton
                  name="close"
                  size={22}
                  color={colors.textSecondary}
                  onPress={() => setIsNoteModalVisible(false)}
                />
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <Text style={styles.noteModalHeader}>{translateExerciseName(noteEditExercise.name)}</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 100, textAlignVertical: 'top' }]}
                  placeholder="Enter workout cue, seat height, or custom setting notes..."
                  placeholderTextColor={colors.textMuted}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  keyboardAppearance="dark"
                  maxLength={150}
                  autoFocus
                />

                <View style={{ flexDirection: 'row', columnGap: spacing.md, marginTop: spacing.md }}>
                  <Pressable
                    style={[styles.btnSecondary, { flex: 1 }]}
                    onPress={() => setIsNoteModalVisible(false)}
                  >
                    <Text style={styles.btnSecondaryText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnPrimary, { flex: 1 }]}
                    onPress={() => {
                      if (onUpdateExerciseNotes) {
                        onUpdateExerciseNotes(noteEditExercise.id, noteText.trim() || undefined);
                      }
                      setIsNoteModalVisible(false);
                      Alert.alert('Success', 'Note updated!');
                    }}
                  >
                    <Text style={styles.btnPrimaryText}>SAVE</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
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
  rowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.bg,
    minHeight:         ITEM_HEIGHT,
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

export default ExercisesScreen;
