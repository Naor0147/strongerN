// screens/AddExerciseScreen.tsx
// Global full-screen exercise picker — multi-select with search & filters
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
import { Exercise } from '../data/mockData';
import IconButton from '../components/ui/IconButton';

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders',
  'Biceps', 'Triceps', 'Glutes', 'Rear Delts', 'Calves', 'Core', 'Forearms',
];

const EQUIPMENT_TYPES = [
  'Barbell', 'Dumbbell', 'Machine', 'Cables', 'Bodyweight', 'Other',
];

const getMuscleColor = (muscleGroup: string): string => {
  const group = muscleGroup.toLowerCase();
  if (group.includes('chest'))      return colors.accent;
  if (group.includes('back'))       return colors.accent;
  if (group.includes('quad'))       return colors.accent;
  if (group.includes('hamstring'))  return colors.accent;
  if (group.includes('shoulder'))   return colors.accent;
  if (group.includes('bicep'))      return colors.accent;
  if (group.includes('tricep'))     return colors.accent;
  if (group.includes('glute'))      return colors.accent;
  if (group.includes('rear'))       return colors.highlight;
  if (group.includes('calve'))      return colors.highlight;
  if (group.includes('core'))       return colors.gold;
  if (group.includes('forearm'))    return colors.accent;
  return colors.textSecondary;
};

export interface AddExerciseScreenProps {
  visible: boolean;
  exercises: Exercise[];
  onConfirm: (exerciseNames: string[]) => void;
  onClose: () => void;
  onAddCustomExercise?: (name: string, muscle: string, equipment: string, isUnilateral?: boolean) => any;
  /** If provided (replace mode), single-tap selects immediately */
  singleSelect?: boolean;
  title?: string;
  sessions?: any[];
}

const AddExerciseScreen: React.FC<AddExerciseScreenProps> = ({
  visible,
  exercises,
  onConfirm,
  onClose,
  onAddCustomExercise,
  singleSelect = false,
  title = 'ADD EXERCISES',
  sessions = [],
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedMuscles, setSelectedMuscles]     = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedNames, setSelectedNames]   = useState<string[]>([]);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [isFilterVisible, setIsFilterVisible]   = useState(false);

  // Custom exercise form
  const [customName, setCustomName]     = useState('');
  const [customMuscle, setCustomMuscle] = useState('Chest');
  const [customEquip, setCustomEquip]   = useState('Barbell');
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset state when opened
  React.useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedMuscles([]);
      setSelectedEquipment([]);
      setSelectedNames([]);
      setIsCreatingCustom(false);
      setIsFilterVisible(false);
      setIsUnilateral(false);
      setShowAdvanced(false);
    }
  }, [visible]);

  const exerciseFrequencies = useMemo(() => {
    const freqs: Record<string, number> = {};
    sessions.forEach((session: any) => {
      if (session.exercises) {
        session.exercises.forEach((ex: any) => {
          if (ex.name) {
            const lowerName = ex.name.toLowerCase().trim();
            freqs[lowerName] = (freqs[lowerName] || 0) + 1;
          }
        });
      }
    });
    return freqs;
  }, [sessions]);

  const filteredExercises = useMemo(() => {
    let result = exercises;

    if (selectedMuscles.length > 0) {
      result = result.filter(ex => selectedMuscles.includes(ex.muscleGroup));
    }
    if (selectedEquipment.length > 0) {
      result = result.filter(ex => selectedEquipment.includes(ex.equipment || 'Other'));
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const scored = result
        .map(ex => {
          const nameLower = ex.name.toLowerCase();
          const muscleLower = ex.muscleGroup.toLowerCase();
          const equipLower = (ex.equipment || '').toLowerCase();
          
          let matchScore = 0;
          
          if (nameLower === q) {
            matchScore = 10000;
          } else if (nameLower.startsWith(q)) {
            matchScore = 5000;
          } else if (new RegExp(`\\b${q}`).test(nameLower)) {
            matchScore = 2000;
          } else if (nameLower.includes(q)) {
            matchScore = 1000;
          } else if (muscleLower.includes(q) || equipLower.includes(q)) {
            matchScore = 100;
          }
          
          if (matchScore === 0) return null;
          
          const freq = exerciseFrequencies[nameLower.trim()] || 0;
          const totalScore = matchScore + freq;
          
          return { ex, totalScore };
        })
        .filter((item): item is { ex: Exercise; totalScore: number } => item !== null);
        
      scored.sort((a, b) => b.totalScore - a.totalScore);
      return scored.map(item => item.ex);
    } else {
      return [...result].sort((a, b) => {
        const freqA = exerciseFrequencies[a.name.toLowerCase().trim()] || 0;
        const freqB = exerciseFrequencies[b.name.toLowerCase().trim()] || 0;
        return freqB - freqA;
      });
    }
  }, [exercises, searchQuery, selectedMuscles, selectedEquipment, exerciseFrequencies]);

  const toggleMuscle = useCallback((m: string) => {
    setSelectedMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }, []);

  const toggleEquip = useCallback((eq: string) => {
    setSelectedEquipment(prev => prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]);
  }, []);

  const toggleSelect = useCallback((name: string) => {
    if (singleSelect) {
      onConfirm([name]);
      return;
    }
    setSelectedNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }, [singleSelect, onConfirm]);

  const handleSaveCustom = () => {
    if (!customName.trim()) return;
    let newExName = customName.trim();
    if (onAddCustomExercise) {
      const newEx = onAddCustomExercise(newExName, customMuscle, customEquip, isUnilateral);
      if (newEx) newExName = newEx.name;
    }
    if (singleSelect) {
      onConfirm([newExName]);
      return;
    }
    setSelectedNames(prev => [...prev, newExName]);
    setIsCreatingCustom(false);
    setCustomName('');
    setIsUnilateral(false);
    setShowAdvanced(false);
  };

  const hasFilters = selectedMuscles.length > 0 || selectedEquipment.length > 0;

  const renderExerciseItem = useCallback(({ item }: { item: Exercise }) => {
    const isSelected = selectedNames.includes(item.name);
    const muscleColor = getMuscleColor(item.muscleGroup);
    return (
      <Pressable
        onPress={() => toggleSelect(item.name)}
        style={[styles.exerciseItem, isSelected && styles.exerciseItemSelected]}
        android_ripple={rippleTokens.surface}
      >
        {/* Left accent dot */}
        <View style={[styles.exerciseDot, { backgroundColor: muscleColor }]} />

        <View style={styles.exerciseItemCenter}>
          <Text
            style={[styles.exerciseItemName, isSelected && styles.exerciseItemNameSelected]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.exerciseItemMeta}>
            <Text style={{ color: muscleColor }}>{item.muscleGroup.toUpperCase()}</Text>
            {'  ·  '}
            <Text style={{ color: colors.highlight }}>{(item.equipment || 'Other').toUpperCase()}</Text>
          </Text>
        </View>

        {/* Checkbox */}
        {!singleSelect && (
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Ionicons name="checkmark" size={13} color={colors.bg} />}
          </View>
        )}
        {singleSelect && (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        )}
      </Pressable>
    );
  }, [selectedNames, toggleSelect, singleSelect]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={isCreatingCustom ? () => setIsCreatingCustom(false) : onClose}
              style={styles.backBtn}
              android_ripple={rippleTokens.borderless}
              accessibilityLabel="Close"
            >
              <Ionicons
                name={isCreatingCustom ? 'arrow-back' : 'chevron-down'}
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>

            <Text style={styles.headerTitle}>
              {isCreatingCustom ? 'CREATE EXERCISE' : title}
            </Text>

            <Pressable
              onPress={() => setIsFilterVisible(v => !v)}
              style={[styles.filterBtn, hasFilters && styles.filterBtnActive]}
              android_ripple={rippleTokens.borderless}
              accessibilityLabel="Toggle filters"
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={hasFilters ? colors.accent : colors.textSecondary}
              />
              {hasFilters && <View style={styles.filterActiveDot} />}
            </Pressable>
          </View>

          {/* ── Filter Panel ── */}
          {isFilterVisible && !isCreatingCustom && (
            <View style={styles.filterPanel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Text style={styles.filterGroupLabel}>MUSCLE</Text>
                {MUSCLE_GROUPS.map(m => {
                  const active = selectedMuscles.includes(m);
                  const mc = getMuscleColor(m);
                  return (
                    <Pressable
                      key={m}
                      onPress={() => toggleMuscle(m)}
                      style={[
                        styles.filterChip,
                        active && { backgroundColor: mc + '20', borderColor: mc },
                      ]}
                    >
                      <Text style={[styles.filterChipText, active && { color: mc, fontFamily: font.semibold }]}>
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Text style={styles.filterGroupLabel}>EQUIP</Text>
                {EQUIPMENT_TYPES.map(eq => {
                  const active = selectedEquipment.includes(eq);
                  return (
                    <Pressable
                      key={eq}
                      onPress={() => toggleEquip(eq)}
                      style={[
                        styles.filterChip,
                        active && { backgroundColor: colors.highlight + '20', borderColor: colors.highlight },
                      ]}
                    >
                      <Text style={[styles.filterChipText, active && { color: colors.highlight, fontFamily: font.semibold }]}>
                        {eq}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {isCreatingCustom ? (
            /* ── Custom Exercise Form ── */
            <ScrollView
              style={styles.customFormScroll}
              contentContainerStyle={styles.customFormContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.formLabel}>EXERCISE NAME</Text>
              <TextInput
                style={styles.formInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g. Incline Dumbbell Press"
                placeholderTextColor={colors.textMuted}
                keyboardAppearance="dark"
                autoFocus
                maxLength={40}
              />

              <Text style={styles.formLabel}>TARGET MUSCLE GROUP</Text>
              <View style={styles.chipGrid}>
                {MUSCLE_GROUPS.map(m => {
                  const active = customMuscle === m;
                  const mc = getMuscleColor(m);
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setCustomMuscle(m)}
                      style={[
                        styles.gridChip,
                        active && { backgroundColor: mc + '20', borderColor: mc },
                      ]}
                    >
                      <Text style={[styles.gridChipText, active && { color: mc, fontFamily: font.bold }]}>
                        {m.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>EQUIPMENT TYPE</Text>
              <View style={styles.chipGrid}>
                {EQUIPMENT_TYPES.map(eq => {
                  const active = customEquip === eq;
                  return (
                    <Pressable
                      key={eq}
                      onPress={() => setCustomEquip(eq)}
                      style={[
                        styles.gridChip,
                        active && { backgroundColor: colors.highlight + '20', borderColor: colors.highlight },
                      ]}
                    >
                      <Text style={[styles.gridChipText, active && { color: colors.highlight, fontFamily: font.bold }]}>
                        {eq.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Advanced Settings Section */}
              <Pressable
                onPress={() => setShowAdvanced(v => !v)}
                style={styles.advancedHeader}
                android_ripple={rippleTokens.surface}
              >
                <Text style={styles.advancedHeaderTitle}>ADVANCED SETTINGS</Text>
                <Ionicons
                  name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>

              {showAdvanced && (
                <View style={styles.advancedContent}>
                  <Text style={styles.formLabel}>EXERCISE MODE</Text>
                  <View style={styles.chipGrid}>
                    <Pressable
                      onPress={() => setIsUnilateral(false)}
                      style={[
                        styles.gridChip,
                        !isUnilateral && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.gridChipText, !isUnilateral && { color: colors.accent, fontFamily: font.bold }]}>
                        BILATERAL (DEFAULT)
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setIsUnilateral(true)}
                      style={[
                        styles.gridChip,
                        isUnilateral && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.gridChipText, isUnilateral && { color: colors.accent, fontFamily: font.bold }]}>
                        UNILATERAL (SINGLE SIDE)
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <View style={styles.formBtnRow}>
                <Pressable
                  style={[styles.formBtn, styles.formBtnCancel]}
                  onPress={() => setIsCreatingCustom(false)}
                  android_ripple={rippleTokens.surface}
                >
                  <Text style={styles.formBtnCancelText}>CANCEL</Text>
                </Pressable>
                <Pressable
                  style={[styles.formBtn, styles.formBtnSave, !customName.trim() && { opacity: 0.4 }]}
                  onPress={handleSaveCustom}
                  disabled={!customName.trim()}
                  android_ripple={rippleTokens.accent}
                >
                  <Text style={styles.formBtnSaveText}>SAVE & ADD</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <>
              {/* ── Search Bar ── */}
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
                  />
                  {searchQuery.length > 0 && (
                    <IconButton
                      name="close-circle"
                      size={16}
                      color={colors.textSecondary}
                      onPress={() => setSearchQuery('')}
                    />
                  )}
                </View>
              </View>

              {/* ── List ── */}
              {filteredExercises.length === 0 && searchQuery.trim() !== '' ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="alert-circle-outline" size={36} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>No results for "{searchQuery}"</Text>
                  <Pressable
                    style={styles.createCustomBtn}
                    onPress={() => {
                      setCustomName(searchQuery.trim());
                      setIsCreatingCustom(true);
                    }}
                    android_ripple={rippleTokens.accent}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colors.bg} style={{ marginRight: spacing.xs }} />
                    <Text style={styles.createCustomBtnText}>Create Custom Exercise</Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  data={filteredExercises}
                  keyExtractor={item => item.id}
                  renderItem={renderExerciseItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  ListFooterComponent={
                    <Pressable
                      style={styles.createCustomRow}
                      onPress={() => setIsCreatingCustom(true)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                      <Text style={styles.createCustomRowText}>Create Custom Exercise</Text>
                    </Pressable>
                  }
                />
              )}

              {/* ── Confirm Bar (multi-select only) ── */}
              {!singleSelect && (
                <View style={styles.confirmBar}>
                  <Text style={styles.confirmCount}>
                    {selectedNames.length > 0
                      ? `${selectedNames.length} selected`
                      : `${filteredExercises.length} exercises`}
                  </Text>
                  <Pressable
                    style={[
                      styles.confirmBtn,
                      selectedNames.length === 0 && styles.confirmBtnDisabled,
                    ]}
                    onPress={() => onConfirm(selectedNames)}
                    disabled={selectedNames.length === 0}
                    android_ripple={rippleTokens.accent}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.bg} style={{ marginRight: spacing.xs }} />
                    <Text style={styles.confirmBtnText}>
                      ADD {selectedNames.length > 0 ? selectedNames.length : ''} EXERCISE{selectedNames.length !== 1 ? 'S' : ''}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default AddExerciseScreen;

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: colors.accent + '60',
    backgroundColor: colors.accentGlow,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },

  // Filter Panel
  filterPanel: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    rowGap: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    columnGap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  filterGroupLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginRight: spacing.xs,
    minWidth: 40,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    columnGap: spacing.sm,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.regular,
    padding: 0,
  },

  // Exercise List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    columnGap: spacing.md,
  },
  exerciseItemSelected: {
    backgroundColor: colors.accentGlow,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xs,
    borderBottomColor: 'transparent',
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  exerciseItemCenter: {
    flex: 1,
    rowGap: 2,
  },
  exerciseItemName: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.medium,
  },
  exerciseItemNameSelected: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
  },
  exerciseItemMeta: {
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  // Create custom row at bottom of list
  createCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  createCustomRowText: {
    color: colors.accent,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    rowGap: spacing.lg,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: font.sizes.base,
    fontFamily: font.medium,
    textAlign: 'center',
  },
  createCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  createCustomBtnText: {
    color: colors.bg,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },

  // Confirm Bar
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmCount: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...(shadow.accentGlow as object),
  },
  confirmBtnDisabled: {
    opacity: 0.35,
  },
  confirmBtnText: {
    color: colors.bg,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.8,
  },

  // Custom Exercise Form
  customFormScroll: {
    flex: 1,
  },
  customFormContent: {
    padding: spacing.lg,
    rowGap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  formLabel: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.medium,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gridChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  gridChipText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  formBtnRow: {
    flexDirection: 'row',
    columnGap: spacing.md,
    marginTop: spacing.lg,
  },
  formBtn: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBtnCancel: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formBtnSave: {
    backgroundColor: colors.accent,
    ...(shadow.accentGlow as object),
  },
  formBtnCancelText: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.8,
  },
  formBtnSaveText: {
    color: colors.bg,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.8,
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
});
