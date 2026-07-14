// screens/WorkoutScreen.tsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
  Clipboard,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef, useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, getSpringConfig } from '../theme';
import { Template, Exercise, mockPrograms, TrainingProgram } from '../data/mockData';
import i18n from '../utils/i18n';

import ScreenHeader from '../components/layout/ScreenHeader';
import Card          from '../components/ui/Card';
import IconButton    from '../components/ui/IconButton';
import SectionLabel  from '../components/ui/SectionLabel';
import PressableRow  from '../components/ui/PressableRow';
import { RoutineSharingModal } from '../components/ui/RoutineSharingModal';
import Sortable from 'react-native-sortables';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RoutineEditorModal from '../components/layout/RoutineEditorModal';
import { WorkoutHeaderSkeleton } from '../components/ui/Skeleton';

interface WorkoutScreenProps {
  isHydrating?:      boolean;
  templates:         Template[];
  exercises:         Exercise[];
  onStartWorkout?:   (name: string, exercises: string[], exercisesDetails?: any[]) => void;
  onAddTemplate?:    (name: string, exercises: string[], folder?: string, exercisesDetails?: any[], notes?: string) => void;
  onDeleteTemplate?: (id: string) => void;
  onUpdateTemplate?: (id: string, name: string, exercises: string[], folder?: string, exercisesDetails?: any[], notes?: string) => void;
  onReorderTemplates?: (newTemplates: Template[]) => void;
  folders?:          string[];
  onAddFolder?:      (name: string) => void;
  onDeleteFolder?:   (name: string) => void;
  activeProgramId?:  string | null;
  programStartDate?: string | null;
  onSubscribeProgram?: (programId: string | null) => void;
  isProgramsEnabled?: boolean;
  enableRoutineFolders?: boolean;
  onAddCustomExercise?: (name: string, muscle: string, equipment: string, isUnilateral?: boolean) => any;
  sessions?:         any[];
  exerciseNameLanguage?: 'en' | 'he';
  onUpdateExerciseNotes?: (id: string, notes?: string) => void;
}


function timeAgo(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return i18n.t('timeAgo.today');
  if (diffDays === 1) return i18n.t('timeAgo.yesterday');
  if (diffDays < 7)  return i18n.t('timeAgo.daysAgo', { count: diffDays });
  const weeks = Math.floor(diffDays / 7);
  return i18n.t('timeAgo.weeksAgo', { count: weeks });
}

// ─── Template Card ────────────────────────────────────────────────
interface TemplateCardProps {
  template: Template;
  onStart?: (name: string, exercises: string[], exercisesDetails?: any[]) => void;
  onMenuPress: (template: Template) => void;
  dragGesture?: any;
}

const TemplateCard: React.FC<TemplateCardProps> = React.memo(({ template, onStart, onMenuPress, dragGesture }) => (
  <Card style={styles.tplCard} padding={0} testID={`workout.template.${template.id}`}>
    <PressableRow
      onPress={() => onStart && onStart(template.name, template.exercises, template.exercisesDetails)}
      padding={{ vertical: spacing.md, horizontal: spacing.md }}
      ripple={rippleTokens.surface}
      accessibilityLabel={`Start ${template.name}`}
    >


      <View style={styles.tplInner}>
        <View style={styles.tplHeader}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs, paddingRight: 60 }}>
            <Text style={styles.tplName} numberOfLines={1}>{template.name}</Text>
            {template.folder && (
              <View style={styles.folderBadge}>
                <Text style={styles.folderBadgeText}>{template.folder.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.tplExCount}>
          {i18n.t('workout.exerciseCount', { count: template.exercises.length })}
        </Text>
        <Text style={styles.tplExList} numberOfLines={2}>
          {template.exercises.join(' · ')}
        </Text>

        {template.notes ? (
          <View style={styles.notesContainer}>
            <Ionicons name="document-text-outline" size={12} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.notesText} numberOfLines={2}>
              {template.notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.tplFooter}>
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text style={styles.tplLastUsed}>{timeAgo(template.lastUsed)}</Text>
        </View>
      </View>
    </PressableRow>

    <View style={styles.tplAbsoluteActions}>
      <Pressable
        onPress={() => onMenuPress(template)}
        style={styles.tplMenuIcon}
        android_ripple={rippleTokens.borderless}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
      </Pressable>
      {dragGesture ? (
        <Sortable.Handle style={styles.tplDragHandle}>
          <Ionicons name="reorder-three" size={22} color={colors.textSecondary} accessibilityLabel="Drag to reorder template" />
        </Sortable.Handle>
      ) : null}
    </View>
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
          <Text style={styles.folderCardCount}>{i18n.t(count === 1 ? 'workout.routineCount' : 'workout.routinesCount', { count })}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
    </PressableRow>
  </Card>
));

const EMPTY_SESSIONS: any[] = [];

// ─── Screen ────────────────────────────────────────────────────────
const WorkoutScreen: React.FC<WorkoutScreenProps> = ({
  isHydrating = false,
  templates,
  exercises,
  onStartWorkout,
  onAddTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  onReorderTemplates,
  folders = i18n.t('extras.defaultFolders') as unknown as string[],
  onAddFolder,
  onDeleteFolder,
  activeProgramId = null,
  programStartDate = null,
  onSubscribeProgram,
  isProgramsEnabled = false,
  enableRoutineFolders = false,
  onAddCustomExercise,
  sessions = EMPTY_SESSIONS,
  exerciseNameLanguage = 'en',
  onUpdateExerciseNotes,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cardListWidth = windowWidth - spacing.lg * 2;
  const [activeTab, setActiveTab] = useState<'routines' | 'programs'>('routines');

  const prevIsProgramsEnabledRef = useRef(isProgramsEnabled);
  if (prevIsProgramsEnabledRef.current !== isProgramsEnabled) {
    prevIsProgramsEnabledRef.current = isProgramsEnabled;
    if (!isProgramsEnabled) {
      setActiveTab('routines');
    }
  }
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('All');
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollRef = useAnimatedRef<ScrollView>();
  
  // Filter popover state
  const [isFilterBarVisible, setIsFilterBarVisible] = useState(false);
  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!enableRoutineFolders) {
      setSelectedFolderFilter('All');
      setCurrentFolder(null);
      setIsFilterBarVisible(false);
    }
  }, [enableRoutineFolders]);

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
    exercisesDetails?: any[];
    folder: string;
    editingId: string | null;
    notes?: string;
  }>({ name: '', exercises: [], exercisesDetails: [], folder: '', editingId: null, notes: '' });

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
    let maxTemplate = templates[0];
    for (let i = 1; i < templates.length; i++) {
      if (templates[i].lastUsed.getTime() > maxTemplate.lastUsed.getTime()) {
        maxTemplate = templates[i];
      }
    }
    return maxTemplate;
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
    setRoutineEditorInitial({ name: '', exercises: [], exercisesDetails: [], folder: '', editingId: null, notes: '' });
    setIsRoutineEditorVisible(true);
  };

  const handleSaveRoutineFromEditor = (name: string, exerciseNames: string[], folder?: string, exercisesDetails?: any[], notes?: string) => {
    const folderVal = folder || undefined;

    // Save exercise notes to the global library
    if (exercisesDetails && Array.isArray(exercisesDetails)) {
      exercisesDetails.forEach((detail: any) => {
        if (detail.name) {
          const trimmedName = detail.name.trim();
          let match = exercises.find(e => e.name.toLowerCase() === trimmedName.toLowerCase());

          if (!match && onAddCustomExercise) {
            const isExUnilateral = Array.isArray(detail.sets) && detail.sets.some((s: any) => s.isUnilateral);
            match = onAddCustomExercise(trimmedName, 'Other', 'Other', isExUnilateral);
          }

          if (match && detail.notes !== undefined && onUpdateExerciseNotes) {
            onUpdateExerciseNotes(match.id, detail.notes);
          }
        }
      });
    }

    if (routineEditorInitial.editingId) {
      if (onUpdateTemplate) {
        onUpdateTemplate(routineEditorInitial.editingId, name, exerciseNames, folderVal, exercisesDetails, notes);
      }
    } else {
      if (onAddTemplate) {
        onAddTemplate(name, exerciseNames, folderVal, exercisesDetails, notes);
      }
    }
  };



  // Calendar program week viewer state
  const [viewingWeek, setViewingWeek] = useState(1);

  // UI-thread entrance micro-animation
  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.96);

  useEffect(() => {
    fadeAnim.value = 0;
    scaleAnim.value = 0.96;
    const easingFn = Easing && typeof Easing.out === 'function' ? Easing.out(Easing.cubic) : undefined;
    fadeAnim.value = withTiming(1, { duration: 280, easing: easingFn });
    scaleAnim.value = withSpring(1, getSpringConfig(140, 16));
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
    flex: 1,
  }));

  const handleDeleteRoutine = (tpl: Template) => {
    Alert.alert(
      i18n.t('workout.deleteRoutine'),
      i18n.t('workout.deleteRoutineMsg', { name: tpl.name }),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.delete'),
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
      exercisesDetails: tpl.exercisesDetails || [],
      folder: tpl.folder || '',
      editingId: tpl.id,
      notes: tpl.notes || '',
    });
    setIsActionSheetVisible(false);
    setIsRoutineEditorVisible(true);
  };

  const handleSaveFolder = () => {
    if (!newFolderName.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('workout.enterFolderName'));
      return;
    }
    if (onAddFolder) {
      onAddFolder(newFolderName.trim());
      setSelectedFolderFilter(newFolderName.trim());
      setNewFolderName('');
      setIsFolderModalVisible(false);
      Alert.alert(i18n.t('common.success'), i18n.t('workout.folderCreatedSuccess'));
    }
  };

  const handleConfirmDeleteFolder = (folderName: string) => {
    Alert.alert(
      i18n.t('workout.deleteFolder'),
      i18n.t('workout.deleteFolderMsg', { name: folderName }),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (onDeleteFolder) {
              onDeleteFolder(folderName);
              // Reset folder filter if we just deleted the active filter
              if (selectedFolderFilter === folderName) {
                setSelectedFolderFilter('All');
                setCurrentFolder(null);
              }
              Alert.alert(i18n.t('workout.folderDeleted'), i18n.t('workout.folderDeletedMsg', { name: folderName }));
            }
          }
        }
      ]
    );
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setImportPayloadText(text);
      } else {
        Alert.alert(i18n.t('common.info'), i18n.t('extras.clipboardEmpty', { defaultValue: 'Clipboard is empty' }));
      }
    } catch (err) {
      Alert.alert(i18n.t('common.error'), 'Failed to read from clipboard');
    }
  };

  const handleImportRoutine = () => {
    if (!importPayloadText.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('workout.enterRoutinePayload'));
      return;
    }
    try {
      let parsed: any;
      const trimmed = importPayloadText.trim();

      // Deep link format: strongern://share?routine=...
      if (trimmed.includes('routine=')) {
        const query = trimmed.split('routine=')[1];
        parsed = JSON.parse(decodeURIComponent(query));
      } else {
        parsed = JSON.parse(trimmed);
      }

      // Support QR compact format (keys: n, e, f, d)
      if (!parsed.name && parsed.n) {
        parsed = {
          name: parsed.n,
          exercises: parsed.e || [],
          folder: parsed.f,
          exercisesDetails: parsed.d,
        };
      }

      if (!parsed.name || !Array.isArray(parsed.exercises)) {
        throw new Error(i18n.t('extras.invalidFormat'));
      }

      if (onAddTemplate) {
        // Save exercise notes to the global library if provided (auto-create if missing)
        if (parsed.exercisesDetails && Array.isArray(parsed.exercisesDetails)) {
          parsed.exercisesDetails.forEach((detail: any) => {
            if (detail.name) {
              const trimmedName = detail.name.trim();
              let match = exercises.find(e => e.name.toLowerCase() === trimmedName.toLowerCase());

              if (!match && onAddCustomExercise) {
                const isExUnilateral = Array.isArray(detail.sets) && detail.sets.some((s: any) => s.isUnilateral);
                match = onAddCustomExercise(trimmedName, 'Other', 'Other', isExUnilateral);
              }

              if (match && detail.notes !== undefined && onUpdateExerciseNotes) {
                onUpdateExerciseNotes(match.id, detail.notes);
              }
            }
          });
        }

        // Auto-create any missing exercises from the general list as well
        if (parsed.exercises && Array.isArray(parsed.exercises)) {
          parsed.exercises.forEach((exName: string) => {
            const trimmedName = exName.trim();
            const exists = exercises.some(e => e.name.toLowerCase() === trimmedName.toLowerCase());
            if (!exists && onAddCustomExercise) {
              const detail = parsed.exercisesDetails?.find((d: any) => d.name.toLowerCase() === trimmedName.toLowerCase());
              const isExUnilateral = detail && Array.isArray(detail.sets) && detail.sets.some((s: any) => s.isUnilateral);
              onAddCustomExercise(trimmedName, 'Other', 'Other', isExUnilateral);
            }
          });
        }

        onAddTemplate(
          parsed.name,
          parsed.exercises,
          parsed.folder,
          parsed.exercisesDetails,
          parsed.notes,
        );
        Alert.alert(i18n.t('common.success'), i18n.t('workout.routineImported', { name: parsed.name }));
        setImportPayloadText('');
        setIsImportModalVisible(false);
      }
    } catch (e: any) {
      Alert.alert(i18n.t('workout.importFailed'), i18n.t('extras.failedToParse', { error: e.message || e }));
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
    const actions: any[] = [
      {
        icon: isSearching ? 'close-outline' as const : 'search-outline' as const,
        label: i18n.t('common.search'),
        onPress: () => {
          setIsSearching(!isSearching);
          if (isSearching) setSearchQuery('');
        }
      }
    ];

    if (enableRoutineFolders) {
      actions.push({
        icon: 'filter-outline' as const,
        label: i18n.t('common.filter'),
        onPress: () => setIsFilterBarVisible(prev => !prev),
        color: selectedFolderFilter !== 'All' ? colors.accent : colors.textPrimary
      });
    }

    actions.push({
      icon: 'download-outline' as const,
      label: i18n.t('common.import'),
      onPress: () => setIsImportModalVisible(true)
    });

    return actions;
  }, [isSearching, activeTab, selectedFolderFilter, enableRoutineFolders]);

  // Calendar days generation
  const calendarDays = useMemo(() => {
    if (!activeProgram) return [];
    
    // Map calendar days (1-7) for the selected week
    const weekDays = i18n.t('extras.weekDaysMon') as unknown as string[];
    
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

  const folderPressHandlers = useMemo(() => {
    const map: Record<string, () => void> = {};
    uniqueFolders.forEach(name => {
      map[name] = () => {
        setCurrentFolder(name);
        setSelectedFolderFilter(name);
      };
    });
    return map;
  }, [uniqueFolders]);

  const renderFolderItem = useCallback(({ item }: { item: { name: string; count: number } }) => (
    <FolderCard
      name={item.name}
      count={item.count}
      onPress={folderPressHandlers[item.name]}
    />
  ), [folderPressHandlers]);

  if (isHydrating) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={i18n.t('workout.title')}
          testID="workout.header"
        />
        <WorkoutHeaderSkeleton />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <Animated.View style={animatedContainerStyle}>
          <ScreenHeader
            title={i18n.t('workout.title')}
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
              {i18n.t('workout.routines')}
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
              {i18n.t('workout.programs')}
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
                  placeholder={i18n.t('workout.searchRoutinesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardAppearance="dark"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                />
              </View>
            </View>
          )}

          {/* Filter Sub-menu (Popover Overlay) */}
          {isFilterBarVisible && (
            <View style={[styles.popoverWrapper, { top: -insets.top, bottom: -100 }]}>
              <Pressable
                style={[styles.popoverBackdrop, { paddingTop: 80 + insets.top }]}
                onPress={() => setIsFilterBarVisible(false)}
              >
                <Pressable
                  style={styles.popoverContainer}
                  onPress={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <View style={styles.popoverHeader}>
                    <Text style={styles.popoverTitle}>{i18n.t('workout.filterRoutines')}</Text>
                    {selectedFolderFilter !== 'All' && (
                      <Pressable onPress={() => {
                        setSelectedFolderFilter('All');
                        setCurrentFolder(null);
                      }} style={styles.clearAllBtn}>
                        <Text style={styles.clearAllText}>{i18n.t('workout.clearFilter')}</Text>
                      </Pressable>
                    )}
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.popoverScroll}>
                    <Text style={styles.popoverSectionTitle}>{i18n.t('workout.filterByCategory')}</Text>
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
                      {enableRoutineFolders && (
                        <Pressable
                          onPress={() => {
                            setIsFilterBarVisible(false);
                            setIsFolderModalVisible(true);
                          }}
                          style={[styles.popoverChip, { borderColor: colors.accent + '30' }]}
                        >
                          <Ionicons name="add" size={12} color={colors.accent} />
                          <Text style={[styles.popoverChipText, { color: colors.accent, fontFamily: font.semibold }]}>
                            {i18n.t('workout.newFolder')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </ScrollView>

                  {/* Footer Apply Button */}
                  <Pressable
                    style={styles.applyBtn}
                    onPress={() => setIsFilterBarVisible(false)}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.applyBtnText}>
                      {i18n.t('workout.applyFilter')}
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
              renderItem={renderFolderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.rowSep} />}
              initialNumToRender={6}
              maxToRenderPerBatch={4}
              updateCellsBatchingPeriod={50}
              windowSize={5}
              removeClippedSubviews
              ListHeaderComponent={
                <View>
                  {/* CTA — Start Empty */}
                  <Pressable
                    onPress={() => onStartWorkout && onStartWorkout(i18n.t('extras.emptyWorkout'), [])}
                    android_ripple={{ color: colors.accent + '15', borderless: false }}
                    style={styles.ctaOutline}
                    accessibilityLabel={i18n.t('extras.startEmptyWorkoutA11y')}
                    accessibilityRole="button"
                    testID="workout.start-empty"
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={styles.ctaOutlineText}>{i18n.t('workout.startEmptyWorkout')}</Text>
                  </Pressable>

                  {/* Folders section header */}

                  {/* Folders section header */}
                  <SectionLabel
                    title={i18n.t('workout.routineFolders')}
                    subtitle={`${folderListData.length} ${i18n.t('workout.folders')}`}
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
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
              scrollEnabled={scrollEnabled}
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
                      <Text style={styles.folderNavBackText}>{i18n.t('workout.folders')}</Text>
                    </Pressable>
                    <View style={styles.folderNavTitleRow}>
                      <Ionicons name="folder-open" size={18} color={colors.violet} />
                      <Text style={styles.folderNavTitle}>{currentFolder}</Text>
                      {currentFolder !== 'All' && (
                        <Pressable
                          onPress={() => handleConfirmDeleteFolder(currentFolder)}
                          style={styles.folderNavDelete}
                          android_ripple={rippleTokens.borderless}
                          accessibilityLabel={i18n.t('extras.deleteFolderA11y')}
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
                    onPress={() => onStartWorkout && onStartWorkout(i18n.t('extras.emptyWorkout'), [])}
                    android_ripple={{ color: colors.accent + '15', borderless: false }}
                    style={styles.ctaOutline}
                    accessibilityLabel={i18n.t('extras.startEmptyWorkoutA11y')}
                    accessibilityRole="button"
                    testID="workout.start-empty"
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={styles.ctaOutlineText}>{i18n.t('workout.startEmptyWorkout')}</Text>
                  </Pressable>
                )}

                {/* Templates section header */}

                {/* Templates section header */}
                <SectionLabel
                  title={currentFolder ? i18n.t('workout.folderRoutines') : i18n.t('workout.myRoutines')}
                  subtitle={searchQuery.trim() ? i18n.t('workout.foundResults', { count: filteredTemplates.length }) : i18n.t('workout.templatesCount', { count: filteredTemplates.length })}
                  rightIcon="add-circle-outline"
                  rightIconColor={colors.accent}
                  onRightPress={() => {
                    import('../utils/soundPlayer').then(m => m.playSoundByKey('chime'));
                    handleOpenCreator();
                  }}
                  style={styles.sectionLabel}
                  testID="workout.templates-section"
                />
              </View>

              {/* Reorderable Draggable List */}
              <Sortable.Flex
                flexDirection="column"
                flexWrap="nowrap"
                gap={0}
                width="fill"
                customHandle
                dragActivationDelay={0}
                dragActivationFailOffset={5}
                activeItemScale={1.02}
                activeItemOpacity={1}
                activeItemShadowOpacity={0.45}
                inactiveItemOpacity={1}
                inactiveItemScale={1}
                enableActiveItemSnap={false}
                dimensionsAnimationType="layout"
                itemsLayoutTransitionMode="reorder"
                dropAnimationDuration={250}
                strategy="insert"
                reorderTriggerOrigin="center"
                overDrag="vertical"
                hapticsEnabled
                scrollableRef={scrollRef}
                onDragStart={() => setScrollEnabled(false)}
                onDragEnd={({ order }) => {
                  if (onReorderTemplates) {
                    onReorderTemplates(order(filteredTemplates));
                  }
                }}
                onActiveItemDropped={() => setScrollEnabled(true)}
                itemExiting={null}
              >
                {filteredTemplates.map((item) => (
                  <View key={item.id} style={[styles.templateCardWrap, { width: cardListWidth }]}>
                    <TemplateCard
                      template={item}
                      onStart={onStartWorkout}
                      onMenuPress={handleMenuPress}
                      dragGesture={true}
                    />
                  </View>
                ))}
              </Sortable.Flex>
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
                    <Text style={styles.activeProgSub}>{i18n.t('workout.activeProgram')}</Text>
                    <Text style={styles.activeProgName}>{activeProgram.name}</Text>
                  </View>
                  <Pressable
                    style={styles.unsubBtn}
                    onPress={() => {
                      Alert.alert(
                        i18n.t('common.unsubscribe'),
                        i18n.t('workout.unsubscribeConfirm', { name: activeProgram.name }),
                        [
                          { text: i18n.t('common.cancel'), style: 'cancel' },
                          { text: i18n.t('common.unsubscribe'), style: 'destructive', onPress: () => onSubscribeProgram && onSubscribeProgram(null) }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.unsubBtnText}>{i18n.t('common.unsubscribe')}</Text>
                  </Pressable>
                </View>
                <Text style={styles.activeProgDesc}>{activeProgram.description}</Text>
                
                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>{i18n.t('workout.programWeeks', { current: viewingWeek, total: activeProgram.weeks })}</Text>
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
                    <Text style={styles.weekSelectBtnText}>{i18n.t('workout.prevWeek')}</Text>
                  </Pressable>
                  <Pressable
                    disabled={viewingWeek === activeProgram.weeks}
                    style={[styles.weekSelectBtn, viewingWeek === activeProgram.weeks && { opacity: 0.3 }]}
                    onPress={() => setViewingWeek(p => Math.min(activeProgram.weeks, p + 1))}
                  >
                    <Text style={styles.weekSelectBtnText}>{i18n.t('workout.nextWeek')}</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </Card>

              {/* Weekly Scheduled Training Calendar */}
              <SectionLabel title={i18n.t('workout.weeklyTrainingSchedule')} subtitle={i18n.t('workout.weekBreakdown', { week: viewingWeek })} style={styles.sectionLabel} />
              
              <View style={styles.calendarContainer}>
                {calendarDays.map((day, idx) => (
                  <View key={day.dayName} style={styles.calendarDayRow}>
                    <View style={styles.calendarDayLeft}>
                      <Text style={styles.calendarDayName}>{day.dayName}</Text>
                      {day.isTraining ? (
                        <View style={styles.calendarBadgeTrain}>
                          <Text style={styles.calendarBadgeTrainText}>{i18n.t('workout.workoutDay')}</Text>
                        </View>
                      ) : (
                        <View style={styles.calendarBadgeRest}>
                          <Text style={styles.calendarBadgeRestText}>{i18n.t('workout.restDay')}</Text>
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
                            <Text style={styles.calendarStartBtnText}>{i18n.t('common.start')}</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.calendarRestBox}>
                          <Ionicons name="moon-outline" size={16} color={colors.textMuted} />
                           <Text style={styles.calendarRestText}>{i18n.t('workout.restMessage')}</Text>
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
              <SectionLabel title={i18n.t('workout.trainingProgramsLibrary')} subtitle={i18n.t('workout.subscribeToSplits')} />
              
              {mockPrograms.map((prog, idx) => (
                <Card key={prog.id} padding={spacing.lg} style={styles.programCard}>
                  <View style={styles.progCardHeader}>
                    <Ionicons name="calendar-sharp" size={24} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.progCardName}>{prog.name}</Text>
                      <Text style={styles.progCardWeeks}>{i18n.t('workout.weeksProgram', { count: prog.weeks })}</Text>
                    </View>
                  </View>
                  <Text style={styles.progCardDesc}>{prog.description}</Text>
                  
                  <Pressable
                    style={styles.subscribeBtn}
                    onPress={() => {
                      if (onSubscribeProgram) {
                        onSubscribeProgram(prog.id);
                        setViewingWeek(1);
                        Alert.alert(i18n.t('workout.subscribed'), i18n.t('workout.subscribedMsg', { name: prog.name }));
                      }
                    }}
                    android_ripple={rippleTokens.accent}
                  >
                    <Text style={styles.subscribeBtnText}>{i18n.t('workout.subscribeScheduling')}</Text>
                  </Pressable>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      )}
      </Animated.View>

      {/* Routine Editor — Full-Screen (replaces old Create/Edit Routine popup) */}
      <RoutineEditorModal
        visible={isRoutineEditorVisible}
        initialName={routineEditorInitial.name}
        initialExercises={routineEditorInitial.exercises}
        initialExercisesDetails={routineEditorInitial.exercisesDetails}
        initialFolder={routineEditorInitial.folder}
        initialNotes={routineEditorInitial.notes}
        editingId={routineEditorInitial.editingId}
        exercises={exercises}
        folders={folders}
        sessions={sessions}
        onSave={handleSaveRoutineFromEditor}
        onClose={() => setIsRoutineEditorVisible(false)}
        onAddCustomExercise={onAddCustomExercise}
        exerciseNameLanguage={exerciseNameLanguage}
        enableRoutineFolders={enableRoutineFolders}
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
              <Text style={styles.modalTitle}>{i18n.t('workout.createFolder')}</Text>
              <IconButton
                name="close"
                size={22}
                color={colors.textSecondary}
                onPress={() => setIsFolderModalVisible(false)}
              />
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>{i18n.t('workout.folderName')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={i18n.t('workout.folderNamePlaceholder')}
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
                  <Text style={[styles.submitBtnText, { color: colors.textSecondary }]}>{i18n.t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, { flex: 1 }]}
                  onPress={handleSaveFolder}
                >
                  <Text style={styles.submitBtnText}>{i18n.t('common.save')}</Text>
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
          animationType="slide"
          transparent
          statusBarTranslucent
          onRequestClose={() => setIsActionSheetVisible(false)}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIsActionSheetVisible(false)}
          >
            <Pressable
              style={[styles.sheetCard, { paddingBottom: insets.bottom + spacing.md }]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Drag handle pill */}
              <View style={styles.sheetHandle} />

              <Text style={styles.sheetTitle}>{selectedTemplate.name.toUpperCase()}</Text>

              <Pressable
                style={styles.sheetItem}
                onPress={() => handleEditRoutine(selectedTemplate)}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="create-outline" size={20} color={colors.accent} />
                <Text style={styles.sheetItemText}>{i18n.t('workout.editRoutine')}</Text>
              </Pressable>

              <Pressable
                style={styles.sheetItem}
                onPress={() => handleDeleteRoutine(selectedTemplate)}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.sheetItemText, { color: colors.error }]}>{i18n.t('workout.deleteRoutine')}</Text>
              </Pressable>

              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  setIsActionSheetVisible(false);
                  setTimeout(() => setIsSharingModalVisible(true), 300);
                }}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="share-social-outline" size={20} color={colors.highlight} />
                <Text style={styles.sheetItemText}>{i18n.t('workout.shareRoutine')}</Text>
              </Pressable>

              <Pressable
                style={[styles.sheetItem, styles.sheetCancel]}
                onPress={() => setIsActionSheetVisible(false)}
                android_ripple={rippleTokens.surface}
              >
                <Text style={styles.sheetCancelText}>{i18n.t('common.cancel')}</Text>
              </Pressable>
            </Pressable>
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

      {/* Routine Import Modal — bottom sheet style */}
      <Modal
        visible={isImportModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setIsImportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.sheetBackdrop} onPress={() => setIsImportModalVisible(false)}>
            <Pressable
              style={[styles.importSheetCard, { paddingBottom: insets.bottom + spacing.md }]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <View style={styles.sheetHandle} />

              <View style={styles.importSheetHeader}>
                <View>
                  <Text style={styles.importSheetTitle}>{i18n.t('workout.importSharedRoutine')}</Text>
                  <Text style={styles.importSheetSub}>Paste a deep link or JSON payload below</Text>
                </View>
                <Pressable
                  style={styles.importSheetCloseBtn}
                  onPress={() => setIsImportModalVisible(false)}
                  android_ripple={rippleTokens.borderless}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Quick paste row */}
              <Pressable
                style={styles.importPasteRow}
                onPress={handlePasteFromClipboard}
                android_ripple={rippleTokens.surface}
              >
                <View style={styles.importPasteIcon}>
                  <Ionicons name="clipboard" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.importPasteTitle}>Paste from Clipboard</Text>
                  <Text style={styles.importPasteSub}>Tap to paste your copied sharing link or JSON</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              {/* Text input */}
              <TextInput
                style={styles.importTextInput}
                placeholder={'strongern://share?routine=... or {"name":"...", "exercises":[...]}'}
                placeholderTextColor={colors.textMuted}
                value={importPayloadText}
                onChangeText={setImportPayloadText}
                multiline
                keyboardAppearance="dark"
                textAlignVertical="top"
              />

              {/* Import button */}
              <Pressable
                style={[styles.submitBtn, !importPayloadText.trim() && { opacity: 0.45 }]}
                onPress={handleImportRoutine}
                android_ripple={rippleTokens.accent}
                disabled={!importPayloadText.trim()}
              >
                <Ionicons name="download-outline" size={16} color={colors.textInverse} />
                <Text style={styles.submitBtnText}>{i18n.t('workout.importRoutine')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  templateCardWrap: {
    marginBottom: spacing.md,
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
    paddingHorizontal: spacing.xs,
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
    overflow: 'hidden',
    position: 'relative',
  },
  tplAbsoluteActions: {
    position: 'absolute',
    top: spacing.md - 4,
    right: spacing.md - 4,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
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
    paddingLeft: 0,
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
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: spacing.sm,
  },
  notesText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    flex: 1,
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
    flexDirection: 'row',
    gap: spacing.sm,
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
    backgroundColor: 'rgba(5, 7, 10, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    rowGap: spacing.xs,
  },
  sheetTitle: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetItemText: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
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
    textAlign: 'center',
  },

  // Import bottom sheet styles
  importSheetCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    rowGap: spacing.md,
  },
  importSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  importSheetTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    letterSpacing: -0.3,
  },
  importSheetSub: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 3,
  },
  importSheetCloseBtn: {
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
  },
  importPasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  importPasteIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importPasteTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
  },
  importPasteSub: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontFamily: font.regular,
    marginTop: 2,
  },
  importTextInput: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.textPrimary,
    padding: spacing.md,
    fontSize: font.sizes.sm,
    fontFamily: 'monospace',
    height: 110,
    textAlignVertical: 'top',
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
    left: 0,
    right: 0,
    zIndex: 999, // Render on top of flat list
  },
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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

export default React.memo(WorkoutScreen);
