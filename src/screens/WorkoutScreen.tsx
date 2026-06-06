// screens/WorkoutScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
import { Template, Exercise, mockPrograms, TrainingProgram } from '../data/mockData';

import ScreenHeader from '../components/layout/ScreenHeader';
import Card          from '../components/ui/Card';
import IconButton    from '../components/ui/IconButton';
import SectionLabel  from '../components/ui/SectionLabel';
import PressableRow  from '../components/ui/PressableRow';
import { RoutineSharingModal } from '../components/ui/RoutineSharingModal';
import { DraggableList } from '../components/ui/DraggableList';
import RoutineEditorModal from '../components/layout/RoutineEditorModal';

interface WorkoutScreenProps {
  templates:         Template[];
  exercises:         Exercise[];
  onStartWorkout?:   (name: string, exercises: string[]) => void;
  onAddTemplate?:    (name: string, exercises: string[], folder?: string) => void;
  onDeleteTemplate?: (id: string) => void;
  onUpdateTemplate?: (id: string, name: string, exercises: string[], folder?: string) => void;
  onReorderTemplates?: (newTemplates: Template[]) => void;
  folders?:          string[];
  onAddFolder?:      (name: string) => void;
  onDeleteFolder?:   (name: string) => void;
  activeProgramId?:  string | null;
  programStartDate?: string | null;
  onSubscribeProgram?: (programId: string | null) => void;
  isProgramsEnabled?: boolean;
  enableRoutineFolders?: boolean;
  onAddCustomExercise?: (name: string, muscle: string, equipment: string) => any;
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
  dragHandlers?: any;
}

const TemplateCard: React.FC<TemplateCardProps> = React.memo(({ template, onStart, onMenuPress, dragHandlers }) => (
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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs }}>
            <Text style={styles.tplName} numberOfLines={1}>{template.name}</Text>
            {template.folder && (
              <View style={styles.folderBadge}>
                <Text style={styles.folderBadgeText}>{template.folder.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs }}>
            <Pressable
              onPress={() => onMenuPress(template)}
              style={styles.tplMenuIcon}
              android_ripple={rippleTokens.borderless}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </Pressable>
            {dragHandlers && (
              <View {...dragHandlers} style={styles.tplDragHandle}>
                <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
              </View>
            )}
          </View>
        </View>

        <Text style={styles.tplExCount}>
          {template.exercises.length} exercises
        </Text>
        <Text style={styles.tplExList} numberOfLines={2}>
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

// ─── Folder Card ──────────────────────────────────────────────────
interface FolderCardProps {
  name: string;
  count: number;
  onPress: () => void;
}

const FolderCard: React.FC<FolderCardProps> = React.memo(({ name, count, onPress }) => (
  <Card style={styles.folderCard} padding={0}>
    <PressableRow
      onPress={onPress}
      padding={{ vertical: spacing.md, horizontal: spacing.md }}
      ripple={rippleTokens.surface}
      accessibilityLabel={`Open ${name} folder`}
    >
      <View style={styles.folderAccentBar} />
      <View style={styles.folderInner}>
        <Ionicons name="folder" size={24} color={colors.violet} style={styles.folderIconLeft} />
        <View style={{ flex: 1 }}>
          <Text style={styles.folderCardName} numberOfLines={1}>{name}</Text>
          <Text style={styles.folderCardCount}>{count} {count === 1 ? 'routine' : 'routines'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
    </PressableRow>
  </Card>
));

// ─── Screen ────────────────────────────────────────────────────────
const WorkoutScreen: React.FC<WorkoutScreenProps> = ({
  templates,
  exercises,
  onStartWorkout,
  onAddTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  onReorderTemplates,
  folders = ['All', 'Bulking Splits', 'Home Workouts', 'Travel'],
  onAddFolder,
  onDeleteFolder,
  activeProgramId = null,
  programStartDate = null,
  onSubscribeProgram,
  isProgramsEnabled = false,
  enableRoutineFolders = false,
  onAddCustomExercise,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'routines' | 'programs'>('routines');

  useEffect(() => {
    if (!isProgramsEnabled) {
      setActiveTab('routines');
    }
  }, [isProgramsEnabled]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('All');
  
  // Filter popover state
  const [isFilterBarVisible, setIsFilterBarVisible] = useState(false);
  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // New folder state
  const [newFolderName, setNewFolderName] = useState('');

  // ellipsis routine actions states
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [isSharingModalVisible, setIsSharingModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importPayloadText, setImportPayloadText] = useState('');

  // Routine Editor (Full-Screen) state
  const [isRoutineEditorVisible, setIsRoutineEditorVisible] = useState(false);
  const [routineEditorInitial, setRoutineEditorInitial] = useState<{
    name: string;
    exercises: string[];
    folder: string;
    editingId: string | null;
  }>({ name: '', exercises: [], folder: '', editingId: null });

  // Filter templates list by folder and search
  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (enableRoutineFolders) {
      if (currentFolder) {
        result = result.filter(t => (t.folder || 'Uncategorized') === currentFolder);
      }
    } else {
      if (selectedFolderFilter !== 'All') {
        result = result.filter(t => t.folder === selectedFolderFilter);
      }
    }
    if (searchQuery.trim()) {
      result = result.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    }
    return result;
  }, [templates, enableRoutineFolders, currentFolder, selectedFolderFilter, searchQuery]);

  const lastUsed = useMemo(() => {
    if (templates.length === 0) return null;
    return [...templates].sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())[0];
  }, [templates]);

  // Active Program Memo
  const activeProgram = useMemo(() => {
    if (!activeProgramId) return null;
    return mockPrograms.find(p => p.id === activeProgramId) || null;
  }, [activeProgramId]);

  // Unique folders list
  const uniqueFolders = useMemo(() => {
    const list = new Set<string>();
    templates.forEach(t => {
      list.add(t.folder || 'Uncategorized');
    });
    folders.forEach(f => {
      if (f !== 'All') list.add(f);
    });
    return Array.from(list);
  }, [templates, folders]);

  // Counts of routines in each folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    templates.forEach(t => {
      const f = t.folder || 'Uncategorized';
      counts[f] = (counts[f] || 0) + 1;
    });
    return counts;
  }, [templates]);

  // Folders list items
  const folderListData = useMemo(() => {
    return uniqueFolders.map(name => ({
      name,
      count: folderCounts[name] || 0,
    }));
  }, [uniqueFolders, folderCounts]);

  // Show folder screen condition
  const showFolderList = useMemo(() => {
    return enableRoutineFolders && templates.length > 1 && !currentFolder && !searchQuery.trim();
  }, [enableRoutineFolders, templates.length, currentFolder, searchQuery]);

  // Manage template card menu click
  const handleMenuPress = useCallback((tpl: Template) => {
    setSelectedTemplate(tpl);
    setIsActionSheetVisible(true);
  }, []);

  const handleOpenCreator = () => {
    setRoutineEditorInitial({ name: '', exercises: [], folder: '', editingId: null });
    setIsRoutineEditorVisible(true);
  };

  const handleSaveRoutineFromEditor = (name: string, exerciseNames: string[], folder?: string) => {
    const folderVal = folder || undefined;
    if (routineEditorInitial.editingId) {
      if (onUpdateTemplate) {
        onUpdateTemplate(routineEditorInitial.editingId, name, exerciseNames, folderVal);
      }
    } else {
      if (onAddTemplate) {
        onAddTemplate(name, exerciseNames, folderVal);
      }
    }
  };

  const handleToggleExerciseSelection = (exName: string) => {
    // legacy compat — no longer used by main flow
  };

  // Calendar program week viewer state
  const [viewingWeek, setViewingWeek] = useState(1);

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
    setRoutineEditorInitial({
      name: tpl.name,
      exercises: tpl.exercises,
      folder: tpl.folder || '',
      editingId: tpl.id,
    });
    setIsActionSheetVisible(false);
    setIsRoutineEditorVisible(true);
  };

  const handleSaveFolder = () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name.');
      return;
    }
    if (onAddFolder) {
      onAddFolder(newFolderName.trim());
      setSelectedFolderFilter(newFolderName.trim());
      setNewFolderName('');
      setIsFolderModalVisible(false);
      Alert.alert('Success', 'Folder created successfully!');
    }
  };

  const handleConfirmDeleteFolder = (folderName: string) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete the folder "${folderName}"?\n\nThe routines inside this folder will NOT be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDeleteFolder) {
              onDeleteFolder(folderName);
              // Reset folder filter if we just deleted the active filter
              if (selectedFolderFilter === folderName) {
                setSelectedFolderFilter('All');
                setCurrentFolder(null);
              }
              Alert.alert('Folder Deleted', `The folder "${folderName}" was successfully removed.`);
            }
          }
        }
      ]
    );
  };

  const handleImportRoutine = () => {
    if (!importPayloadText.trim()) {
      Alert.alert('Error', 'Please enter a routine share payload.');
      return;
    }
    try {
      let parsed: any;
      if (importPayloadText.includes('routine=')) {
        const query = importPayloadText.split('routine=')[1];
        parsed = JSON.parse(decodeURIComponent(query));
      } else {
        parsed = JSON.parse(importPayloadText.trim());
      }
      
      if (!parsed.name || !parsed.exercises) {
        throw new Error('Invalid format: missing name or exercises.');
      }
      
      if (onAddTemplate) {
        onAddTemplate(parsed.name, parsed.exercises, parsed.folder);
        Alert.alert('Success', `Routine "${parsed.name}" successfully imported!`);
        setImportPayloadText('');
        setIsImportModalVisible(false);
      }
    } catch (e: any) {
      Alert.alert('Import Failed', `Failed to parse routine: ${e.message || e}`);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: Template }) => (
      <TemplateCard template={item} onStart={onStartWorkout} onMenuPress={handleMenuPress} />
    ),
    [onStartWorkout, handleMenuPress]
  );

  const headerActions = useMemo(() => {
    if (activeTab === 'programs') return [];
    return [
      {
        icon: isSearching ? 'close-outline' as const : 'search-outline' as const,
        label: 'Search',
        onPress: () => {
          setIsSearching(!isSearching);
          if (isSearching) setSearchQuery('');
        }
      },
      {
        icon: 'filter-outline' as const,
        label: 'Filter',
        onPress: () => setIsFilterBarVisible(prev => !prev),
        color: selectedFolderFilter !== 'All' ? colors.accent : colors.textPrimary
      },
      {
        icon: 'download-outline' as const,
        label: 'Import',
        onPress: () => setIsImportModalVisible(true)
      }
    ];
  }, [isSearching, activeTab, selectedFolderFilter]);

  // Calendar days generation
  const calendarDays = useMemo(() => {
    if (!activeProgram) return [];
    
    // Map calendar days (1-7) for the selected week
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return weekDays.map((dayName, idx) => {
      // Index of training day (e.g. Day 1, Day 2, Day 3)
      // Standard layout: Week 1 has training days based on program layout
      // E.g. for PPL: 3 training days per week. Bench/Dead/Squat/OHP: 4 training days per week.
      const trainingDaysPerWeek = activeProgram.id === 'prog-ppl' ? 3 : 4;
      
      // Determine if this day is a training day in the schedule
      // Monday = Training 1, Wednesday = Training 2, Friday = Training 3, Sunday = Training 4 (or similar split)
      let trainingDayIndex = -1;
      if (activeProgram.id === 'prog-ppl') {
        // Mon, Wed, Fri
        if (idx === 0) trainingDayIndex = 0;
        if (idx === 2) trainingDayIndex = 1;
        if (idx === 4) trainingDayIndex = 2;
      } else {
        // Mon, Tue, Thu, Fri
        if (idx === 0) trainingDayIndex = 0;
        if (idx === 1) trainingDayIndex = 1;
        if (idx === 3) trainingDayIndex = 2;
        if (idx === 4) trainingDayIndex = 3;
      }
      
      const overallDayNumber = (viewingWeek - 1) * trainingDaysPerWeek + trainingDayIndex + 1;
      const scheduledWorkout = trainingDayIndex !== -1 
        ? activeProgram.days.find(d => d.dayNumber === overallDayNumber) 
        : null;

      return {
        dayName,
        isTraining: trainingDayIndex !== -1,
        workout: scheduledWorkout,
      };
    });
  }, [activeProgram, viewingWeek]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Workout"
        actions={headerActions}
        testID="workout.header"
      />

      {/* Tab Header Selector */}
      {isProgramsEnabled && (
        <View style={styles.tabContainer}>
          <Pressable
            style={styles.tabButton}
            onPress={() => setActiveTab('routines')}
          >
            <Text style={[
              styles.tabButtonText,
              activeTab === 'routines' ? styles.tabButtonTextActive : styles.tabButtonTextInactive
            ]}>
              Routines
            </Text>
            {activeTab === 'routines' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => setActiveTab('programs')}
          >
            <Text style={[
              styles.tabButtonText,
              activeTab === 'programs' ? styles.tabButtonTextActive : styles.tabButtonTextInactive
            ]}>
              Programs
            </Text>
            {activeTab === 'programs' && <View style={styles.tabIndicator} />}
          </Pressable>
        </View>
      )}

      {activeTab === 'routines' ? (
        <>
          {/* Routines View: Search & Folders */}
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

          {/* Filter Sub-menu (Popover Overlay) */}
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
                    <Text style={styles.popoverTitle}>Filter Routines</Text>
                    {selectedFolderFilter !== 'All' && (
                      <Pressable onPress={() => {
                        setSelectedFolderFilter('All');
                        setCurrentFolder(null);
                      }} style={styles.clearAllBtn}>
                        <Text style={styles.clearAllText}>Clear Filter</Text>
                      </Pressable>
                    )}
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.popoverScroll}>
                    <Text style={styles.popoverSectionTitle}>FILTER BY CATEGORY / FOLDER</Text>
                    <View style={styles.popoverGrid}>
                      {folders.map(f => {
                        const isActive = selectedFolderFilter === f;
                        return (
                          <Pressable
                            key={f}
                            onPress={() => {
                              setSelectedFolderFilter(f);
                              if (enableRoutineFolders) {
                                setCurrentFolder(f === 'All' ? null : f);
                              }
                            }}
                            style={[
                              styles.popoverChip,
                              isActive && {
                                backgroundColor: colors.violet + '15',
                                borderColor: colors.violet,
                              }
                            ]}
                          >
                            <Ionicons
                              name={f === 'All' ? 'grid-outline' : 'folder-open-outline'}
                              size={12}
                              color={isActive ? colors.violet : colors.textSecondary}
                            />
                            <Text style={[
                              styles.popoverChipText,
                              isActive && { color: colors.textPrimary, fontFamily: font.semibold }
                            ]}>
                              {f}
                            </Text>
                            {f !== 'All' && (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleConfirmDeleteFolder(f);
                                }}
                                style={styles.deleteFolderBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="close" size={13} color={colors.error} />
                              </Pressable>
                            )}
                          </Pressable>
                        );
                      })}

                      {/* Add Folder button inside popover */}
                      <Pressable
                        onPress={() => {
                          setIsFilterBarVisible(false);
                          setIsFolderModalVisible(true);
                        }}
                        style={[styles.popoverChip, { borderColor: colors.accent + '30' }]}
                      >
                        <Ionicons name="add" size={12} color={colors.accent} />
                        <Text style={[styles.popoverChipText, { color: colors.accent, fontFamily: font.semibold }]}>
                          New Folder
                        </Text>
                      </Pressable>
                    </View>
                  </ScrollView>

                  {/* Footer Apply Button */}
                  <Pressable
                    style={styles.applyBtn}
                    onPress={() => setIsFilterBarVisible(false)}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.applyBtnText}>
                      Apply Filter
                    </Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </View>
          )}

          {showFolderList ? (
            <FlatList
              data={folderListData}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <FolderCard
                  name={item.name}
                  count={item.count}
                  onPress={() => {
                    setCurrentFolder(item.name);
                    setSelectedFolderFilter(item.name);
                  }}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.rowSep} />}
              ListHeaderComponent={
                <View>
                  {/* CTA — Start Empty */}
                  <Pressable
                    onPress={() => onStartWorkout && onStartWorkout('Empty Workout', [])}
                    android_ripple={{ color: colors.accent + '15', borderless: false }}
                    style={styles.ctaOutline}
                    accessibilityLabel="Start an empty workout"
                    accessibilityRole="button"
                    testID="workout.start-empty"
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={styles.ctaOutlineText}>Start an Empty Workout</Text>
                  </Pressable>

                  {/* Quick Start */}
                  {lastUsed && <QuickStartCard template={lastUsed} onStart={onStartWorkout} />}

                  {/* Folders section header */}
                  <SectionLabel
                    title="Routine Folders"
                    subtitle={`${folderListData.length} folders`}
                    rightIcon="add-circle-outline"
                    rightIconColor={colors.accent}
                    onRightPress={() => setIsFolderModalVisible(true)}
                    style={styles.sectionLabel}
                  />
                </View>
              }
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
            >
              {/* ListHeaderComponent Content */}
              <View>
                {enableRoutineFolders && templates.length > 1 && currentFolder && (
                  <View style={styles.folderNavHeader}>
                    <Pressable
                      onPress={() => {
                        setCurrentFolder(null);
                        setSelectedFolderFilter('All');
                      }}
                      style={styles.folderNavBack}
                      android_ripple={rippleTokens.borderless}
                    >
                      <Ionicons name="arrow-back" size={18} color={colors.accent} />
                      <Text style={styles.folderNavBackText}>Folders</Text>
                    </Pressable>
                    <View style={styles.folderNavTitleRow}>
                      <Ionicons name="folder-open" size={18} color={colors.violet} />
                      <Text style={styles.folderNavTitle}>{currentFolder}</Text>
                      {currentFolder !== 'All' && (
                        <Pressable
                          onPress={() => handleConfirmDeleteFolder(currentFolder)}
                          style={styles.folderNavDelete}
                          android_ripple={rippleTokens.borderless}
                          accessibilityLabel="Delete folder"
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                {/* CTA — Start Empty */}
                {!currentFolder && (
                  <Pressable
                    onPress={() => onStartWorkout && onStartWorkout('Empty Workout', [])}
                    android_ripple={{ color: colors.accent + '15', borderless: false }}
                    style={styles.ctaOutline}
                    accessibilityLabel="Start an empty workout"
                    accessibilityRole="button"
                    testID="workout.start-empty"
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={styles.ctaOutlineText}>Start an Empty Workout</Text>
                  </Pressable>
                )}

                {/* Quick Start */}
                {!currentFolder && lastUsed && <QuickStartCard template={lastUsed} onStart={onStartWorkout} />}

                {/* Templates section header */}
                <SectionLabel
                  title={currentFolder ? "Folder Routines" : "My Routines"}
                  subtitle={searchQuery.trim() ? `Found ${filteredTemplates.length} results` : `${filteredTemplates.length} templates`}
                  rightIcon="add-circle-outline"
                  rightIconColor={colors.accent}
                  onRightPress={handleOpenCreator}
                  style={styles.sectionLabel}
                  testID="workout.templates-section"
                />
              </View>

              {/* Reorderable Draggable List */}
              <DraggableList
                data={filteredTemplates}
                keyExtractor={(item) => item.id}
                onDragEnd={(newData) => {
                  if (onReorderTemplates) {
                    onReorderTemplates(newData);
                  }
                }}
                renderItem={({ item, dragHandlers }) => (
                  <View style={{ marginBottom: spacing.md }}>
                    <TemplateCard
                      template={item}
                      onStart={onStartWorkout}
                      onMenuPress={handleMenuPress}
                      dragHandlers={dragHandlers}
                    />
                  </View>
                )}
              />
            </ScrollView>
          )}
        </>
      ) : (
        /* Programs Calendar / Subscriptions View */
        <ScrollView contentContainerStyle={styles.programsScroll} showsVerticalScrollIndicator={false}>
          {activeProgram ? (
            <>
              {/* Active subscription details */}
              <Card padding={spacing.lg} style={styles.activeProgramCard}>
                <View style={styles.activeProgHeader}>
                  <View style={styles.activeProgIconWrap}>
                    <Ionicons name="ribbon-outline" size={24} color={colors.highlight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeProgSub}>ACTIVE PROGRAM</Text>
                    <Text style={styles.activeProgName}>{activeProgram.name}</Text>
                  </View>
                  <Pressable
                    style={styles.unsubBtn}
                    onPress={() => {
                      Alert.alert(
                        'Unsubscribe',
                        `Are you sure you want to stop training on "${activeProgram.name}"?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Unsubscribe', style: 'destructive', onPress: () => onSubscribeProgram && onSubscribeProgram(null) }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.unsubBtnText}>UNSUBSCRIBE</Text>
                  </Pressable>
                </View>
                <Text style={styles.activeProgDesc}>{activeProgram.description}</Text>
                
                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>Week {viewingWeek} of {activeProgram.weeks}</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${(viewingWeek / activeProgram.weeks) * 100}%` }]}>
                      <LinearGradient
                        colors={[colors.highlight, colors.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  </View>
                </View>

                {/* Week selector controls */}
                <View style={styles.weekSelectorRow}>
                  <Pressable
                    disabled={viewingWeek === 1}
                    style={[styles.weekSelectBtn, viewingWeek === 1 && { opacity: 0.3 }]}
                    onPress={() => setViewingWeek(p => Math.max(1, p - 1))}
                  >
                    <Ionicons name="arrow-back-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.weekSelectBtnText}>PREV WEEK</Text>
                  </Pressable>
                  <Pressable
                    disabled={viewingWeek === activeProgram.weeks}
                    style={[styles.weekSelectBtn, viewingWeek === activeProgram.weeks && { opacity: 0.3 }]}
                    onPress={() => setViewingWeek(p => Math.min(activeProgram.weeks, p + 1))}
                  >
                    <Text style={styles.weekSelectBtnText}>NEXT WEEK</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </Card>

              {/* Weekly Scheduled Training Calendar */}
              <SectionLabel title="Weekly Training Schedule" subtitle={`Week ${viewingWeek} breakdown`} style={styles.sectionLabel} />
              
              <View style={styles.calendarContainer}>
                {calendarDays.map((day, idx) => (
                  <View key={idx} style={styles.calendarDayRow}>
                    <View style={styles.calendarDayLeft}>
                      <Text style={styles.calendarDayName}>{day.dayName}</Text>
                      {day.isTraining ? (
                        <View style={styles.calendarBadgeTrain}>
                          <Text style={styles.calendarBadgeTrainText}>WORKOUT</Text>
                        </View>
                      ) : (
                        <View style={styles.calendarBadgeRest}>
                          <Text style={styles.calendarBadgeRestText}>REST</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.calendarDayRight}>
                      {day.workout ? (
                        <View style={styles.calendarWorkoutBox}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.calendarWorkoutName}>{day.workout.workoutName}</Text>
                            <Text style={styles.calendarWorkoutExList} numberOfLines={1}>
                              {day.workout.exercises.join(' · ')}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.calendarStartBtn}
                            onPress={() => onStartWorkout && onStartWorkout(day.workout!.workoutName, day.workout!.exercises)}
                            android_ripple={rippleTokens.accent}
                          >
                            <Text style={styles.calendarStartBtnText}>START</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.calendarRestBox}>
                          <Ionicons name="moon-outline" size={16} color={colors.textMuted} />
                          <Text style={styles.calendarRestText}>Sleep, recover, and grow stronger.</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* No program subscribed, display catalog */}
              <SectionLabel title="Training Programs Library" subtitle="Subscribe to structured splits" />
              
              {mockPrograms.map((prog, idx) => (
                <Card key={idx} padding={spacing.lg} style={styles.programCard}>
                  <View style={styles.progCardHeader}>
                    <Ionicons name="calendar-sharp" size={24} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.progCardName}>{prog.name}</Text>
                      <Text style={styles.progCardWeeks}>{prog.weeks} weeks program</Text>
                    </View>
                  </View>
                  <Text style={styles.progCardDesc}>{prog.description}</Text>
                  
                  <Pressable
                    style={styles.subscribeBtn}
                    onPress={() => {
                      if (onSubscribeProgram) {
                        onSubscribeProgram(prog.id);
                        setViewingWeek(1);
                        Alert.alert('Subscribed!', `You are now subscribed to ${prog.name}!`);
                      }
                    }}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.subscribeBtnText}>SUBSCRIBE & SCHEDULING</Text>
                  </Pressable>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Routine Editor — Full-Screen (replaces old Create/Edit Routine popup) */}
      <RoutineEditorModal
        visible={isRoutineEditorVisible}
        initialName={routineEditorInitial.name}
        initialExercises={routineEditorInitial.exercises}
        initialFolder={routineEditorInitial.folder}
        editingId={routineEditorInitial.editingId}
        exercises={exercises}
        folders={folders}
        onSave={handleSaveRoutineFromEditor}
        onClose={() => setIsRoutineEditorVisible(false)}
        onAddCustomExercise={onAddCustomExercise}
      />

      {/* Modal B: Create Folder Modal */}
      <Modal
        visible={isFolderModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsFolderModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CREATE FOLDER</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsFolderModalVisible(false)}
              />
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>FOLDER NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Vacation Splits"
                placeholderTextColor={colors.textMuted}
                value={newFolderName}
                onChangeText={setNewFolderName}
                keyboardAppearance="dark"
                maxLength={20}
                autoFocus
              />

              <View style={{ flexDirection: 'row', columnGap: spacing.md, marginTop: spacing.md }}>
                <Pressable
                  style={[styles.submitBtn, { flex: 1, backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setIsFolderModalVisible(false)}
                >
                  <Text style={[styles.submitBtnText, { color: colors.textSecondary }]}>CANCEL</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, { flex: 1 }]}
                  onPress={handleSaveFolder}
                >
                  <Text style={styles.submitBtnText}>SAVE</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Ellipsis Context Options Sheet */}
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
                style={styles.sheetItem}
                onPress={() => {
                  setIsActionSheetVisible(false);
                  setIsSharingModalVisible(true);
                }}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="share-social-outline" size={20} color={colors.highlight} />
                <Text style={styles.sheetItemText}>Share Routine</Text>
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

      {/* Routine Sharing Modal */}
      <RoutineSharingModal
        visible={isSharingModalVisible}
        template={selectedTemplate}
        onClose={() => {
          setIsSharingModalVisible(false);
          setSelectedTemplate(null);
        }}
      />

      {/* Routine Import Modal */}
      <Modal
        visible={isImportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsImportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>IMPORT SHARED ROUTINE</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsImportModalVisible(false)}
              />
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>PASTE SHARE PAYLOAD (JSON OR LINK)</Text>
              <TextInput
                style={[styles.textInput, { height: 120, textAlignVertical: 'top' }]}
                placeholder='Paste sharing link or stringified JSON routine split payload...'
                placeholderTextColor={colors.textMuted}
                value={importPayloadText}
                onChangeText={setImportPayloadText}
                multiline
                keyboardAppearance="dark"
              />

              <Pressable
                style={styles.submitBtn}
                onPress={handleImportRoutine}
                android_ripple={rippleTokens.accent}
              >
                <Text style={styles.submitBtnText}>IMPORT ROUTINE</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const QuickStartCard: React.FC<{ template: Template; onStart?: (name: string, exercises: string[]) => void }> = React.memo(({ template, onStart }) => (
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

  // Tabs style
  tabContainer: {
    flexDirection: 'row',
    columnGap: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  tabButton: {
    paddingVertical: spacing.sm,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: font.sizes.lg,
    fontFamily: font.semibold,
    letterSpacing: -0.3,
  },
  tabButtonTextActive: {
    color: colors.textPrimary,
  },
  tabButtonTextInactive: {
    color: colors.textMuted,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
  },

  // Folder categories row
  folderRow: {
    marginBottom: spacing.lg,
  },
  folderScroll: {
    paddingHorizontal: spacing.lg,
    columnGap: spacing.xs + 2,
    alignItems: 'center',
  },
  folderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
  },
  folderPillActive: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
  },
  folderPillAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  folderPillText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs - 1,
    fontFamily: font.bold,
  },
  folderPillTextActive: {
    color: colors.accent,
  },

  // Folder Badge in Routine Card
  folderBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.xs - 2,
    backgroundColor: colors.highlight + '15',
    borderColor: colors.highlight + '50',
    borderWidth: 1,
  },
  folderBadgeText: {
    color: colors.highlight,
    fontSize: 8,
    fontFamily: font.bold,
  },

  // CTA
  ctaOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    columnGap: spacing.sm,
    marginBottom: spacing.lg,
    backgroundColor: 'transparent',
  },
  ctaOutlineText: {
    color: colors.accent,
    fontSize: font.sizes.base,
    fontFamily: font.semibold,
    letterSpacing: 0.2,
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

  // Template separators
  rowSep: { height: spacing.md },

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
    alignItems:     'center',
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
  tplDragHandle: {
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

  // Programs View Layout
  programsScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    rowGap: spacing.md,
  },
  programCard: {
    rowGap: spacing.md,
  },
  progCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  progCardName: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
  },
  progCardWeeks: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
  },
  progCardDesc: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    lineHeight: 19,
  },
  subscribeBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...(shadow.accentGlow as object),
  },
  subscribeBtnText: {
    color: colors.textInverse,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },

  // Active Program styling
  activeProgramCard: {
    backgroundColor: colors.surface,
    borderColor: colors.highlight + '80',
    borderWidth: 1.5,
    rowGap: spacing.md,
  },
  activeProgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  activeProgIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.highlight + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeProgSub: {
    color: colors.highlight,
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  activeProgName: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
  },
  unsubBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderColor: colors.error,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsubBtnText: {
    color: colors.error,
    fontSize: 9,
    fontFamily: font.bold,
  },
  activeProgDesc: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    lineHeight: 18,
  },
  progressContainer: {
    rowGap: spacing.xs,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.semibold,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  weekSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  weekSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
  },
  weekSelectBtnText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontFamily: font.bold,
  },

  // Calendar Training Schedule Layout
  calendarContainer: {
    rowGap: spacing.sm,
  },
  calendarDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  calendarDayLeft: {
    width: 60,
    alignItems: 'center',
    rowGap: 4,
  },
  calendarDayName: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
  },
  calendarBadgeTrain: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
  },
  calendarBadgeTrainText: {
    color: colors.accent,
    fontSize: 8,
    fontFamily: font.bold,
  },
  calendarBadgeRest: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  calendarBadgeRestText: {
    color: colors.textMuted,
    fontSize: 8,
    fontFamily: font.bold,
  },
  calendarDayRight: {
    flex: 1,
  },
  calendarWorkoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    columnGap: spacing.sm,
  },
  calendarWorkoutName: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
  },
  calendarWorkoutExList: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 2,
  },
  calendarStartBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarStartBtnText: {
    color: colors.textInverse,
    fontSize: 10,
    fontFamily: font.bold,
  },
  calendarRestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  calendarRestText: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
  },

  // Folder Selectors in Creator
  folderSelectorRow: {
    marginVertical: spacing.xs,
    height: 34,
  },
  folderSelectorBtn: {
    paddingHorizontal: spacing.md,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    marginRight: 6,
  },
  folderSelectorBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  folderSelectorBtnText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs - 1,
    fontFamily: font.bold,
  },
  folderSelectorBtnTextActive: {
    color: colors.textInverse,
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
    maxHeight: 180,
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
    padding: 20,
    rowGap: spacing.sm,
  },
  sheetTitle: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetItemText: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  sheetCancel: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  sheetCancelText: {
    color: colors.accent,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },

  // Folder visual styling
  folderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  folderAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.violet,
  },
  folderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
  },
  folderIconLeft: {
    marginRight: spacing.xs,
  },
  folderCardName: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
  },
  folderCardCount: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    marginTop: 2,
  },
  folderNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  folderNavBack: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  folderNavBackText: {
    color: colors.accent,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  folderNavTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    flex: 1,
  },
  folderNavTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
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
  applyBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  applyBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
  },
  deleteFolderBtn: {
    padding: 2,
    marginLeft: 2,
  },
  folderNavDelete: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
});

export default WorkoutScreen;
