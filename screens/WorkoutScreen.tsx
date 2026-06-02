// screens/WorkoutScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
import { Template, Exercise } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import Card          from '../components/ui/Card';
import IconButton    from '../components/ui/IconButton';
import SectionLabel  from '../components/ui/SectionLabel';
import PressableRow  from '../components/ui/PressableRow';

interface WorkoutScreenProps {
  templates:         Template[];
  exercises:         Exercise[];
  onStartWorkout?:   (name: string, exercises: string[]) => void;
  onAddTemplate?:    (name: string, exercises: string[]) => void;
  onDeleteTemplate?: (id: string) => void;
  onUpdateTemplate?: (id: string, name: string, exercises: string[]) => void;
}

function timeAgo(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  const weeks = Math.floor(diffDays / 7);
  return `${weeks}w ago`;
}

// ─── Template Card ────────────────────────────────────────────────
interface TemplateCardProps {
  template: Template;
  onStart?: (name: string, exercises: string[]) => void;
  onMenuPress: (template: Template) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = React.memo(({ template, onStart, onMenuPress }) => (
  <Card style={styles.tplCard} padding={0} testID={`workout.template.${template.id}`}>
    <PressableRow
      onPress={() => onStart && onStart(template.name, template.exercises)}
      padding={{ vertical: spacing.md, horizontal: spacing.md }}
      ripple={rippleTokens.surface}
      accessibilityLabel={`Start ${template.name}`}
    >
      <View style={styles.tplAccentBar} />

      <View style={styles.tplInner}>
        <View style={styles.tplHeader}>
          <Text style={styles.tplName} numberOfLines={2}>{template.name}</Text>
          <Pressable
            onPress={() => onMenuPress(template)}
            style={styles.tplMenuIcon}
            android_ripple={rippleTokens.borderless}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.tplExCount}>
          {template.exercises.length} exercises
        </Text>
        <Text style={styles.tplExList} numberOfLines={3}>
          {template.exercises.join(' · ')}
        </Text>

        <View style={styles.tplFooter}>
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text style={styles.tplLastUsed}>{timeAgo(template.lastUsed)}</Text>
        </View>
      </View>
    </PressableRow>
  </Card>
));

// ─── Quick Start Card (last used) ────────────────────────────────
interface QuickStartProps {
  template: Template;
  onStart?: (name: string, exercises: string[]) => void;
}

const QuickStartCard: React.FC<QuickStartProps> = React.memo(({ template, onStart }) => (
  <Card padding={0} variant="active" style={styles.quickCard} testID="workout.quick-start">
    <PressableRow
      onPress={() => onStart && onStart(template.name, template.exercises)}
      padding={{ vertical: spacing.md, horizontal: spacing.lg }}
      ripple={rippleTokens.accent}
      accessibilityLabel={`Quick start ${template.name}`}
    >
      <View style={styles.quickInner}>
        <View style={styles.quickLeft}>
          <View style={styles.quickIconWrap}>
            <Ionicons name="flash" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.quickLabel}>Quick Start</Text>
            <Text style={styles.quickName}>{template.name}</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-circle" size={28} color={colors.accent} />
      </View>
    </PressableRow>
  </Card>
));

// ─── List Header ──────────────────────────────────────────────────
interface ListHeaderProps {
  count:    number;
  lastUsed: Template | null;
  onStart?: (name: string, exercises: string[]) => void;
  onAddPress: () => void;
}

const ListHeader: React.FC<ListHeaderProps> = React.memo(({ count, lastUsed, onStart, onAddPress }) => (
  <View>
    {/* CTA — Start Empty */}
    <Pressable
      onPress={() => onStart && onStart('Empty Workout', [])}
      android_ripple={{ color: '#FFFFFF25', borderless: false }}
      style={styles.ctaWrap}
      accessibilityLabel="Start an empty workout"
      accessibilityRole="button"
      testID="workout.start-empty"
    >
      <LinearGradient
        colors={[colors.accent, colors.accentDim]}
        style={styles.ctaGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.ctaText}>START AN EMPTY WORKOUT</Text>
      </LinearGradient>
    </Pressable>

    {/* Quick Start */}
    {lastUsed && <QuickStartCard template={lastUsed} onStart={onStart} />}

    {/* Templates section header */}
    <SectionLabel
      title="My Routines"
      subtitle={`${count} templates`}
      rightIcon="add-circle-outline"
      rightIconColor={colors.accent}
      onRightPress={onAddPress}
      style={styles.sectionLabel}
      testID="workout.templates-section"
    />
  </View>
));

// ─── Screen ────────────────────────────────────────────────────────
const WorkoutScreen: React.FC<WorkoutScreenProps> = ({
  templates,
  exercises,
  onStartWorkout,
  onAddTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  
  // ellipsis routine actions states
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);

  // Routine Creator form states
  const [newRoutineName, setNewRoutineName] = useState('');
  const [selectedExerciseNames, setSelectedExerciseNames] = useState<string[]>([]);
  const [routineExQuery, setRoutineExQuery] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Filter exercises in routine creator
  const filteredCreatorExercises = useMemo(() => {
    if (!routineExQuery.trim()) return exercises;
    return exercises.filter(
      e => e.name.toLowerCase().includes(routineExQuery.toLowerCase().trim())
    );
  }, [exercises, routineExQuery]);

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    return templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
  }, [templates, searchQuery]);

  const pairs = useMemo(() => {
    const result: [Template, Template | null][] = [];
    for (let i = 0; i < filteredTemplates.length; i += 2) {
      result.push([filteredTemplates[i], filteredTemplates[i + 1] ?? null]);
    }
    return result;
  }, [filteredTemplates]);

  const lastUsed = useMemo(() => {
    if (templates.length === 0) return null;
    return [...templates].sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())[0];
  }, [templates]);

  // Manage template card menu click
  const handleMenuPress = useCallback((tpl: Template) => {
    setSelectedTemplate(tpl);
    setIsActionSheetVisible(true);
  }, []);

  const handleOpenCreator = () => {
    setNewRoutineName('');
    setSelectedExerciseNames([]);
    setEditingTemplateId(null);
    setRoutineExQuery('');
    setIsCreateModalVisible(true);
  };

  const handleSaveRoutine = () => {
    if (!newRoutineName.trim()) {
      Alert.alert('Error', 'Please enter a routine name.');
      return;
    }
    if (selectedExerciseNames.length === 0) {
      Alert.alert('Error', 'Please select at least one exercise.');
      return;
    }

    if (editingTemplateId) {
      if (onUpdateTemplate) {
        onUpdateTemplate(editingTemplateId, newRoutineName.trim(), selectedExerciseNames);
        Alert.alert('Success', 'Routine updated successfully!');
      }
    } else {
      if (onAddTemplate) {
        onAddTemplate(newRoutineName.trim(), selectedExerciseNames);
        Alert.alert('Success', 'Routine created successfully!');
      }
    }
    setIsCreateModalVisible(false);
  };

  const handleToggleExerciseSelection = (exName: string) => {
    setSelectedExerciseNames(prev =>
      prev.includes(exName)
        ? prev.filter(name => name !== exName)
        : [...prev, exName]
    );
  };

  const handleDeleteRoutine = (tpl: Template) => {
    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${tpl.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDeleteTemplate) {
              onDeleteTemplate(tpl.id);
              setIsActionSheetVisible(false);
              setSelectedTemplate(null);
            }
          }
        }
      ]
    );
  };

  const handleEditRoutine = (tpl: Template) => {
    setNewRoutineName(tpl.name);
    setSelectedExerciseNames(tpl.exercises);
    setEditingTemplateId(tpl.id);
    setRoutineExQuery('');
    setIsActionSheetVisible(false);
    setIsCreateModalVisible(true);
  };

  const renderPair = useCallback(
    ({ item }: { item: [Template, Template | null] }) => (
      <View style={styles.templateRow}>
        <View style={styles.templateCol}>
          <TemplateCard template={item[0]} onStart={onStartWorkout} onMenuPress={handleMenuPress} />
        </View>
        <View style={styles.templateColGap} />
        <View style={styles.templateCol}>
          {item[1] ? <TemplateCard template={item[1]} onStart={onStartWorkout} onMenuPress={handleMenuPress} /> : null}
        </View>
      </View>
    ),
    [onStartWorkout, handleMenuPress]
  );

  const keyExtractor = useCallback(
    (item: [Template, Template | null]) => item[0].id,
    []
  );

  const listHeader = useMemo(
    () => <ListHeader count={templates.length} lastUsed={lastUsed} onStart={onStartWorkout} onAddPress={handleOpenCreator} />,
    [templates.length, lastUsed, onStartWorkout]
  );

  const headerActions = useMemo(() => [
    {
      icon: isSearching ? 'close-outline' as const : 'search-outline' as const,
      label: 'Search',
      onPress: () => {
        setIsSearching(!isSearching);
        if (isSearching) setSearchQuery('');
      }
    }
  ], [isSearching]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Workout"
        actions={headerActions}
        testID="workout.header"
      />

      {isSearching && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search routines by name..."
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

      <FlatList
        data={pairs}
        keyExtractor={keyExtractor}
        renderItem={renderPair}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        overScrollMode="never"
        ItemSeparatorComponent={() => <View style={styles.rowSep} />}
      />

      {/* Modal 1: Create / Edit Routine */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTemplateId ? 'EDIT WORKOUT ROUTINE' : 'CREATE WORKOUT ROUTINE'}
              </Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsCreateModalVisible(false)}
              />
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>ROUTINE NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Upper Body Focus"
                placeholderTextColor={colors.textMuted}
                value={newRoutineName}
                onChangeText={setNewRoutineName}
                keyboardAppearance="dark"
                maxLength={40}
              />

              <Text style={styles.inputLabel}>
                SELECT EXERCISES ({selectedExerciseNames.length} SELECTED)
              </Text>
              <View style={styles.routineSearch}>
                <Ionicons name="search" size={14} color={colors.textSecondary} />
                <TextInput
                  style={styles.routineSearchInput}
                  placeholder="Search exercises..."
                  placeholderTextColor={colors.textMuted}
                  value={routineExQuery}
                  onChangeText={setRoutineExQuery}
                  keyboardAppearance="dark"
                />
              </View>

              <FlatList
                data={filteredCreatorExercises}
                keyExtractor={item => item.id}
                style={styles.exerciseSelectorList}
                renderItem={({ item }) => {
                  const isChecked = selectedExerciseNames.includes(item.name);
                  return (
                    <Pressable
                      onPress={() => handleToggleExerciseSelection(item.name)}
                      style={[
                        styles.exerciseSelectItem,
                        isChecked && styles.exerciseSelectItemChecked
                      ]}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={[
                        styles.exerciseSelectName,
                        isChecked && styles.exerciseSelectNameChecked
                      ]}>
                        {item.name}
                      </Text>
                      <View style={[
                        styles.checkbox,
                        isChecked && styles.checkboxChecked
                      ]}>
                        {isChecked && <Ionicons name="checkmark" size={12} color="#0D0F14" />}
                      </View>
                    </Pressable>
                  );
                }}
              />

              <Pressable
                style={styles.submitBtn}
                onPress={handleSaveRoutine}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.submitBtnText}>
                  {editingTemplateId ? 'SAVE CHANGES' : 'CREATE ROUTINE'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Ellipsis Context Options Sheet */}
      {selectedTemplate && (
        <Modal
          visible={isActionSheetVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setIsActionSheetVisible(false)}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIsActionSheetVisible(false)}
          >
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>{selectedTemplate.name.toUpperCase()}</Text>
              
              <Pressable
                style={styles.sheetItem}
                onPress={() => handleEditRoutine(selectedTemplate)}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="create-outline" size={20} color={colors.accent} />
                <Text style={styles.sheetItemText}>Edit Routine</Text>
              </Pressable>

              <Pressable
                style={styles.sheetItem}
                onPress={() => handleDeleteRoutine(selectedTemplate)}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.sheetItemText, { color: colors.error }]}>Delete Routine</Text>
              </Pressable>

              <Pressable
                style={[styles.sheetItem, styles.sheetCancel]}
                onPress={() => setIsActionSheetVisible(false)}
                android_ripple={rippleTokens.surface}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
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

  // CTA
  ctaWrap: {
    borderRadius: radius.md,
    overflow:     'hidden',
    marginBottom: spacing.md,
    ...(shadow.accentGlow as object),
  },
  ctaGradient: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: spacing.lg + 2,
    columnGap:       spacing.sm,
    borderRadius:    radius.md,
  },
  ctaText: {
    color:         '#fff',
    fontSize:      font.sizes.md,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },

  // Quick Start
  quickCard: {
    marginBottom: spacing.lg,
  },
  quickInner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  quickLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.md,
    flex:          1,
  },
  quickIconWrap: {
    width:           38,
    height:          38,
    borderRadius:    radius.sm,
    backgroundColor: colors.accentGlow,
    alignItems:      'center',
    justifyContent:  'center',
  },
  quickLabel: {
    color:      colors.accent,
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
    letterSpacing: 0.5,
  },
  quickName: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.bold,
  },

  // Section
  sectionLabel: { marginBottom: spacing.sm },

  // Template grid
  templateRow: {
    flexDirection: 'row',
  },
  templateCol: {
    flex: 1,
  },
  templateColGap: {
    width: spacing.sm,
  },
  rowSep: { height: spacing.sm },

  // Template card
  tplCard: {
    flex:     1,
    overflow: 'hidden',
  },
  tplAccentBar: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    left:            0,
    width:           3,
    backgroundColor: colors.highlight,
  },
  tplInner: {
    paddingLeft: spacing.xs + 2,
  },
  tplHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.xs,
    columnGap:      spacing.xs,
  },
  tplMenuIcon: {
    padding:      8,
    borderRadius: radius.full,
    alignItems:   'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },
  tplName: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.semibold,
    flex:       1,
    letterSpacing: -0.2,
  },
  tplExCount: {
    color:        colors.accent,
    fontSize:     font.sizes.xs,
    fontFamily:   font.medium,
    marginBottom: 3,
  },
  tplExList: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
    lineHeight: 19,
  },
  tplFooter: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     3,
    marginTop:     spacing.sm,
  },
  tplLastUsed: {
    color:      colors.textMuted,
    fontSize:   font.sizes.xs,
    fontFamily: font.regular,
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
  modalForm: {
    rowGap: spacing.md,
    flex: 1,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    marginTop: spacing.xs,
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

  // Selector list inside Creator
  routineSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    height: 38,
    paddingHorizontal: spacing.md,
    columnGap: spacing.xs,
  },
  routineSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    height: '100%',
    padding: 0,
  },
  exerciseSelectorList: {
    maxHeight: 220,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  exerciseSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseSelectItemChecked: {
    backgroundColor: colors.surface2,
  },
  exerciseSelectName: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
  },
  exerciseSelectNameChecked: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderColor: colors.borderStrong,
    borderWidth: 1.5,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...(shadow.accentGlow as object),
  },
  submitBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 1,
  },

  // Ellipsis sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 24,
    rowGap: spacing.md,
  },
  sheetTitle: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    paddingVertical: spacing.md,
  },
  sheetItemText: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.semibold,
  },
  sheetCancel: {
    marginTop: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color: colors.textSecondary,
    fontSize: font.sizes.base,
    fontFamily: font.semibold,
  },
});

export default WorkoutScreen;
