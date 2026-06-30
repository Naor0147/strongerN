// components/layout/RoutineEditorModal.tsx
// Full-screen Routine Editor — visual twin of ActiveWorkoutModal
// Header: editable routine name field (instead of timer) + SAVE button (instead of FINISH)
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Vibration,
  Alert,
  LayoutAnimation,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as RN from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../../theme';
import { Exercise } from '../../data/mockData';
import IconButton from '../ui/IconButton';
import AddExerciseScreen from '../../screens/AddExerciseScreen';
import { CustomWorkoutKeyboard } from '../ui/CustomWorkoutKeyboard';
import i18n from '../../utils/i18n';
import { SwipeableRow } from './SwipeableRow';
import { SetRow } from './SetRow';
import { exerciseBlockStyles } from './exerciseBlockStyles';
import { ExerciseCard } from './ExerciseCard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SetRecord {
  id:        string;
  weight:    string;
  reps:    string;
  category?: 'W' | 'S' | 'D' | 'F';
  isUnilateral?: boolean;
  leftWeight?:   string;
  leftReps?:     string;
  rightWeight?:  string;
  rightReps?:    string;
}

interface RoutineExercise {
  id: string;
  name: string;
  sets: SetRecord[];
  superSetGroupId?: string;
}

interface RoutineEditorModalProps {
  visible:               boolean;
  initialName?:          string;
  initialExercises?:     string[];
  initialExercisesDetails?: any[];
  initialFolder?:        string;
  initialNotes?:         string;
  editingId?:            string | null;
  exercises:             Exercise[];
  folders:               string[];
  onSave:                (name: string, exerciseNames: string[], folder?: string, exercisesDetails?: any[], notes?: string) => void;
  onClose:               () => void;
  onAddCustomExercise?:  (name: string, muscle: string, equipment: string) => any;
  sessions?:             any[];
  exerciseNameLanguage?: 'en' | 'he';
}

// Contiguous supersets verification & dissolution helper
function sanitizeSuperSets(items: RoutineExercise[]): RoutineExercise[] {
  const seenGroups = new Set<string>();
  let lastGroupId: string | undefined = undefined;
  
  const result = items.map((item, idx) => {
    const gid = item.superSetGroupId;
    if (!gid) {
      lastGroupId = undefined;
      return item;
    }
    
    // If we've seen this group ID before, but it's not contiguous with the last one, split it!
    if (seenGroups.has(gid) && lastGroupId !== gid) {
      const newGid = `ss-split-${Date.now()}-${idx}-${Math.random()}`;
      lastGroupId = newGid;
      return { ...item, superSetGroupId: newGid };
    }
    
    seenGroups.add(gid);
    lastGroupId = gid;
    return item;
  });
  
  // Dissolve groups containing < 2 exercises
  const groupCounts: Record<string, number> = {};
  result.forEach(item => {
    if (item.superSetGroupId) {
      groupCounts[item.superSetGroupId] = (groupCounts[item.superSetGroupId] || 0) + 1;
    }
  });
  
  return result.map(item => {
    if (item.superSetGroupId && groupCounts[item.superSetGroupId] < 2) {
      return { ...item, superSetGroupId: undefined };
    }
    return item;
  });
}

// ─── DraggableListItem Component ──────────────────────────────────────────────
interface DraggableListItemProps {
  itemKey: string;
  isActive: boolean;
  dragY: SharedValue<number>;
  children: React.ReactNode;
  itemLayouts: React.MutableRefObject<Record<string, { y: number; height: number }>>;
}

const DraggableListItem: React.FC<DraggableListItemProps> = ({
  itemKey,
  isActive,
  dragY,
  children,
  itemLayouts,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: isActive ? dragY.value : 0 }],
      zIndex: isActive ? 999 : undefined,
      opacity: isActive ? 0.85 : undefined,
      backgroundColor: isActive ? colors.surface2 : undefined,
      shadowColor: isActive ? '#000' : undefined,
      shadowOffset: isActive ? { width: 0, height: 4 } : undefined,
      shadowOpacity: isActive ? 0.45 : undefined,
      shadowRadius: isActive ? 10 : undefined,
      elevation: isActive ? 8 : undefined,
    };
  });

  return (
    <Animated.View
      onLayout={e => {
        if (!isActive) {
          itemLayouts.current[itemKey] = {
            y: e.nativeEvent.layout.y,
            height: e.nativeEvent.layout.height,
          };
        }
      }}
      style={animatedStyle}
    >
      {children}
    </Animated.View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_ANY_ARRAY: any[] = [];

const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  visible,
  initialName = '',
  initialExercises = EMPTY_STRING_ARRAY,
  initialExercisesDetails = EMPTY_ANY_ARRAY,
  initialFolder = '',
  initialNotes = '',
  editingId = null,
  exercises,
  folders,
  onSave,
  onClose,
  onAddCustomExercise,
  sessions = EMPTY_ANY_ARRAY,
  exerciseNameLanguage = 'en',
}) => {
  const insets = useSafeAreaInsets();
  const [routineName,  setRoutineName]  = useState(initialName);
  const [routineFolder, setRoutineFolder] = useState(initialFolder);
  const [routineNotes, setRoutineNotes] = useState(initialNotes);
  const [editorExercises, setEditorExercises] = useState<RoutineExercise[]>([]);
  const editorExercisesRef = useRef<RoutineExercise[]>([]);
  useEffect(() => {
    editorExercisesRef.current = editorExercises;
  }, [editorExercises]);
  const [isAddExerciseVisible, setIsAddExerciseVisible] = useState(false);
  const [isFolderPickerVisible, setIsFolderPickerVisible] = useState(false);
  const [isDiscardConfirmVisible, setIsDiscardConfirmVisible] = useState(false);

  const [activeInput, setActiveInput] = useState<{
    exIdx: number;
    setIdx: number;
    fieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
    focusTime?: number;
  } | null>(null);
  const [tempInputValue, setTempInputValue] = useState('');
  const tempInputValueRef = useRef('');
  const activeInputRef = useRef<typeof activeInput>(null);

  useEffect(() => {
    activeInputRef.current = activeInput;
  }, [activeInput]);

  const inputRefs = useRef<{ [key: string]: any }>({});
  const initialRef = useRef<{ name: string; folder: string; exercisesStr: string } | null>(null);

  // Drag state
  const dragY = useSharedValue(0);
  const dragIdx       = useRef(-1);
  const hoverIdx      = useRef(-1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemLayouts   = useRef<{ [key: string]: { y: number; height: number } }>({});

  // Exercise context menu
  const [exMenuIdx,     setExMenuIdx]     = useState<number | null>(null);
  const [isExMenuVisible, setIsExMenuVisible] = useState(false);

  // ── Render-phase prop-change resets (avoids no-adjust-state-on-prop-change) ──
  // When `visible` transitions to true, reset transient state inline so React
  // can batch it with the current render instead of triggering an extra one.
  const prevVisibleRef = useRef(visible);
  if (prevVisibleRef.current !== visible) {
    prevVisibleRef.current = visible;
    if (visible) {
      setRoutineName(initialName || '');
      setRoutineFolder(initialFolder || '');
      setRoutineNotes(initialNotes || '');
      setIsDiscardConfirmVisible(false);

      // Compute initial exercises inline (derived entirely from props)
      let initialComputed: RoutineExercise[] = [];
      if (initialExercisesDetails && initialExercisesDetails.length > 0) {
        initialComputed = initialExercisesDetails.map((ex, exIdx) => {
          const libEx = exercises.find(e => e.name.toLowerCase() === ex.name.toLowerCase());
          const isUnilateral = libEx?.isUnilateral || false;
          return {
            id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
            name: ex.name,
            superSetGroupId: ex.superSetGroupId,
            sets: ex.sets.map((s: any, sIdx: number) => ({
              id: `s-${exIdx}-${sIdx}-${Date.now()}-${Math.random()}`,
              weight: s.weight ? s.weight.toString() : '0',
              reps: s.reps ? s.reps.toString() : '10',
              category: s.category || 'S',
              isUnilateral: s.isUnilateral !== undefined ? s.isUnilateral : isUnilateral,
              leftWeight: s.leftWeight !== undefined ? s.leftWeight.toString() : undefined,
              leftReps: s.leftReps !== undefined ? s.leftReps.toString() : undefined,
              rightWeight: s.rightWeight !== undefined ? s.rightWeight.toString() : undefined,
              rightReps: s.rightReps !== undefined ? s.rightReps.toString() : undefined,
            })),
          };
        });
      } else {
        initialComputed = initialExercises.map((name, idx) => {
          const libEx = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
          const isUnilateral = libEx?.isUnilateral || false;
          return {
            id: `ex-${idx}-${Date.now()}-${Math.random()}`,
            name,
            sets: [
              { id: `s-${idx}-0-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
              { id: `s-${idx}-1-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
              { id: `s-${idx}-2-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
            ],
          };
        });
      }
      setEditorExercises(initialComputed);
      setActiveId(null);
    }
  }

  // Snapshot initial state and reset animation value whenever modal opens
  // (state resets are done inline above via prevVisibleRef; only non-state
  // side-effects live here to satisfy no-adjust-state-on-prop-change)
  useEffect(() => {
    if (visible) {
      // Re-derive exercises to snapshot into initialRef (mirrors render-phase logic)
      let initialComputed: RoutineExercise[] = [];
      if (initialExercisesDetails && initialExercisesDetails.length > 0) {
        initialComputed = initialExercisesDetails.map((ex, exIdx) => {
          const libEx = exercises.find(e => e.name.toLowerCase() === ex.name.toLowerCase());
          const isUnilateral = libEx?.isUnilateral || false;
          return {
            id: `ex-${exIdx}-${Date.now()}-${Math.random()}`,
            name: ex.name,
            superSetGroupId: ex.superSetGroupId,
            sets: ex.sets.map((s: any, sIdx: number) => ({
              id: `s-${exIdx}-${sIdx}-${Date.now()}-${Math.random()}`,
              weight: s.weight ? s.weight.toString() : '0',
              reps: s.reps ? s.reps.toString() : '10',
              category: s.category || 'S',
              isUnilateral: s.isUnilateral !== undefined ? s.isUnilateral : isUnilateral,
              leftWeight: s.leftWeight !== undefined ? s.leftWeight.toString() : undefined,
              leftReps: s.leftReps !== undefined ? s.leftReps.toString() : undefined,
              rightWeight: s.rightWeight !== undefined ? s.rightWeight.toString() : undefined,
              rightReps: s.rightReps !== undefined ? s.rightReps.toString() : undefined,
            })),
          };
        });
      } else {
        initialComputed = initialExercises.map((name, idx) => {
          const libEx = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
          const isUnilateral = libEx?.isUnilateral || false;
          return {
            id: `ex-${idx}-${Date.now()}-${Math.random()}`,
            name,
            sets: [
              { id: `s-${idx}-0-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
              { id: `s-${idx}-1-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
              { id: `s-${idx}-2-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
            ],
          };
        });
      }

      initialRef.current = {
        name: initialName || '',
        folder: initialFolder || '',
        exercisesStr: JSON.stringify(initialComputed.map(ex => ({
          name: ex.name,
          superSetGroupId: ex.superSetGroupId,
          sets: ex.sets.map((s: any) => ({
            weight: s.weight,
            reps: s.reps,
            category: s.category || 'S',
            isUnilateral: !!s.isUnilateral,
            leftWeight: s.leftWeight,
            leftReps: s.leftReps,
            rightWeight: s.rightWeight,
            rightReps: s.rightReps,
          })),
        }))),
      };

      dragY.value = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const checkHasChanges = () => {
    if (!initialRef.current) return false;
    if (routineName.trim() !== initialRef.current.name) return true;
    if (routineFolder.trim() !== initialRef.current.folder) return true;

    const currentExercisesSimplified = editorExercises.map(ex => ({
      name: ex.name,
      superSetGroupId: ex.superSetGroupId,
      sets: ex.sets.map(s => ({
        weight: s.weight,
        reps: s.reps,
        category: s.category || 'S',
        isUnilateral: !!s.isUnilateral,
        leftWeight: s.leftWeight,
        leftReps: s.leftReps,
        rightWeight: s.rightWeight,
        rightReps: s.rightReps,
      })),
    }));

    return JSON.stringify(currentExercisesSimplified) !== initialRef.current.exercisesStr;
  };

  const handleCloseAttempt = () => {
    if (checkHasChanges()) {
      setIsDiscardConfirmVisible(true);
    } else {
      onClose();
    }
  };

  // ── Set helpers ──────────────────────────────────────────────────────────────
  const addSet = useCallback((exIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditorExercises(prev => {
      const next = [...prev];
      const exName = next[exIdx].name;
      const libEx = exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
      const isUnilateral = libEx?.isUnilateral || false;
      const last = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx].sets = [
        ...next[exIdx].sets,
        {
          id:       `s-${exIdx}-${Date.now()}-${Math.random()}`,
          weight:   last?.weight ?? '0',
          reps:     last?.reps   ?? '10',
          category: last?.category ?? 'S',
          isUnilateral,
          leftWeight:   isUnilateral ? (last?.leftWeight ?? last?.weight ?? '0') : undefined,
          leftReps:     isUnilateral ? (last?.leftReps ?? last?.reps ?? '10') : undefined,
          rightWeight:  isUnilateral ? (last?.rightWeight ?? last?.weight ?? '0') : undefined,
          rightReps:    isUnilateral ? (last?.rightReps ?? last?.reps ?? '10') : undefined,
        },
      ];
      return next;
    });
  }, [exercises]);

  const deleteSet = useCallback((exIdx: number, setIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditorExercises(prev => {
      const next = [...prev];
      next[exIdx].sets = next[exIdx].sets.filter((_, i) => i !== setIdx);
      return next;
    });
  }, []);

  const updateSetField = useCallback((exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'rpe' | 'category' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps', value: string) => {
    setEditorExercises(prev => {
      const next = [...prev];
      (next[exIdx].sets[setIdx] as any)[field] = value;
      return next;
    });
  }, []);

  // Stable keyboard close/dismiss handler
  const handleCloseKeyboard = useCallback(() => {
    if (activeInputRef.current) {
      updateSetField(activeInputRef.current.exIdx, activeInputRef.current.setIdx, activeInputRef.current.fieldName, tempInputValueRef.current);
    }
    setActiveInput(null);
  }, [updateSetField]);

  // Handle custom keyboard "Next" button click
  const handleNextField = useCallback(() => {
    if (!activeInput) return;
    const { exIdx, setIdx, fieldName } = activeInput;

    // Commit current temp value
    updateSetField(exIdx, setIdx, fieldName, tempInputValueRef.current);

    const currentEx = editorExercises[exIdx];
    if (!currentEx) return;

    const currentSet = currentEx.sets[setIdx];
    if (!currentSet) return;

    const focusField = (targetExIdx: number, targetSetIdx: number, targetFieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps') => {
      const key = `${targetExIdx}-${targetSetIdx}-${targetFieldName}`;
      setActiveInput({ exIdx: targetExIdx, setIdx: targetSetIdx, fieldName: targetFieldName, focusTime: Date.now() });
      if (inputRefs.current[key]) {
        inputRefs.current[key].focus();
      }
    };

    if (fieldName === 'weight') {
      focusField(exIdx, setIdx, 'reps');
      return;
    }

    if (fieldName === 'leftWeight') {
      focusField(exIdx, setIdx, 'leftReps');
      return;
    }
    if (fieldName === 'leftReps') {
      focusField(exIdx, setIdx, 'rightWeight');
      return;
    }
    if (fieldName === 'rightWeight') {
      focusField(exIdx, setIdx, 'rightReps');
      return;
    }

    if (fieldName === 'reps' || fieldName === 'rightReps') {
      if (setIdx < currentEx.sets.length - 1) {
        const nextSet = currentEx.sets[setIdx + 1];
        const nextField = nextSet.isUnilateral ? 'leftWeight' : 'weight';
        focusField(exIdx, setIdx + 1, nextField);
        return;
      }

      if (exIdx < editorExercises.length - 1) {
        const nextEx = editorExercises[exIdx + 1];
        const nextSet = nextEx.sets[0];
        if (nextSet) {
          const nextField = nextSet.isUnilateral ? 'leftWeight' : 'weight';
          focusField(exIdx + 1, 0, nextField);
          return;
        }
      }
    }

    handleCloseKeyboard();
  }, [activeInput, editorExercises, updateSetField, handleCloseKeyboard]);

  // ── Drag helpers (long-press handle) ─────────────────────────────────────────
  const handleMove = useCallback((gestureStateY: number) => {
    if (dragIdx.current === -1 || !activeId) return;
    const currentLayout = itemLayouts.current[activeId];
    if (!currentLayout) return;

    const currentCenterY = currentLayout.y + currentLayout.height / 2 + gestureStateY;
    let targetIndex = dragIdx.current;

    setEditorExercises(current => {
      for (let i = 0; i < current.length; i++) {
        const key = current[i].id;
        const layout = itemLayouts.current[key];
        if (layout && key !== activeId) {
          if (i < dragIdx.current && currentCenterY < layout.y + layout.height) {
            targetIndex = i;
            break;
          }
          if (i > dragIdx.current && currentCenterY > layout.y) {
            targetIndex = i;
          }
        }
      }

      if (targetIndex !== hoverIdx.current) {
        hoverIdx.current = targetIndex;
        const reordered = [...current];
        const [movedItem] = reordered.splice(dragIdx.current, 1);
        reordered.splice(targetIndex, 0, movedItem);
        dragIdx.current = targetIndex;
        if (Platform.OS !== 'web') Vibration.vibrate(10);
        return reordered;
      }
      return current;
    });
  }, [activeId]);

  const gestureMap = useRef<{ [id: string]: any }>({});
  const getDragHandlers = useCallback((itemKey: string, index: number) => {
    if (!gestureMap.current[itemKey]) {
      const panGesture = Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          setActiveId(itemKey);
          const currentIdx = editorExercisesRef.current.findIndex(e => e.id === itemKey);
          dragIdx.current   = currentIdx !== -1 ? currentIdx : index;
          hoverIdx.current  = dragIdx.current;
          dragY.value = 0;
          if (Platform.OS !== 'web') Vibration.vibrate(20);
        })
        .onUpdate((e) => {
          dragY.value = e.translationY;
          handleMove(e.translationY);
        })
        .onEnd(() => {
          setActiveId(null);
          dragIdx.current  = -1;
          hoverIdx.current = -1;
          dragY.value = 0;
          setEditorExercises(prev => sanitizeSuperSets(prev));
        })
        .onFinalize(() => {
          setActiveId(null);
          dragIdx.current  = -1;
          hoverIdx.current = -1;
          dragY.value = 0;
          setEditorExercises(prev => sanitizeSuperSets(prev));
        });
      gestureMap.current[itemKey] = panGesture;
    }
    return gestureMap.current[itemKey];
  }, [handleMove]);

  // ── Add exercises callback ────────────────────────────────────────────────────
  const handleSetFocus = useCallback((ex: number, s: number, field: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps') => {
    // 1. Commit the active input first
    if (activeInputRef.current) {
      updateSetField(activeInputRef.current.exIdx, activeInputRef.current.setIdx, activeInputRef.current.fieldName, tempInputValueRef.current);
    }
    
    // 2. Set the new input value and focus
    const currentVal = editorExercisesRef.current[ex]?.sets[s]?.[field] || '';
    setTempInputValue(String(currentVal));
    tempInputValueRef.current = String(currentVal);
    
    const newInput = { exIdx: ex, setIdx: s, fieldName: field, focusTime: Date.now() };
    setActiveInput(newInput);
    activeInputRef.current = newInput;
  }, [updateSetField]);

  const handleConfirmExercises = (names: string[]) => {
    setEditorExercises(prev => [
      ...prev,
      ...names.map((name, idx) => {
        const libEx = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
        const isUnilateral = libEx?.isUnilateral || false;
        return {
          id: `ex-new-${idx}-${Date.now()}-${Math.random()}`,
          name,
          sets: [
            { id: `s-new-${idx}-0-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
            { id: `s-new-${idx}-1-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
            { id: `s-new-${idx}-2-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const, isUnilateral },
          ],
        };
      }),
    ]);
    setIsAddExerciseVisible(false);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!routineName.trim()) {
      Alert.alert(i18n.t('routineEditor.nameRequired'), i18n.t('routineEditor.nameRequiredMsg'));
      return;
    }
    if (editorExercises.length === 0) {
      Alert.alert(i18n.t('routineEditor.noExercises'), i18n.t('routineEditor.noExercisesMsg'));
      return;
    }
    const folderVal = routineFolder.trim() || undefined;

    const exercisesDetails = editorExercises.map(ex => ({
      name: ex.name,
      superSetGroupId: ex.superSetGroupId,
      sets: ex.sets.map(s => ({
        weight: parseFloat(s.weight) || 0,
        reps: parseInt(s.reps, 10) || 0,
        category: s.category || 'S',
        isUnilateral: !!s.isUnilateral,
        leftWeight: s.leftWeight !== undefined ? (parseFloat(s.leftWeight) || 0) : undefined,
        leftReps: s.leftReps !== undefined ? (parseInt(s.leftReps, 10) || 0) : undefined,
        rightWeight: s.rightWeight !== undefined ? (parseFloat(s.rightWeight) || 0) : undefined,
        rightReps: s.rightReps !== undefined ? (parseInt(s.rightReps, 10) || 0) : undefined,
      })),
    }));

    onSave(routineName.trim(), editorExercises.map(ex => ex.name), folderVal, exercisesDetails, routineNotes.trim() || undefined);
    onClose();
  };

  const isEditing = !!editingId;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseAttempt}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={edStyles.keyboardAvoid}
        >
          <View style={[edStyles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={edStyles.container}>

              {/* ── Header ── */}
              <View style={edStyles.header}>
                <View style={edStyles.headerLeft}>
                  <Pressable
                    onPress={handleCloseAttempt}
                    style={edStyles.backBtn}
                    android_ripple={rippleTokens.borderless}
                    accessibilityLabel={i18n.t('extras.closeRoutineEditorA11y')}
                  >
                    <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
                  </Pressable>
                </View>

                {/* Center: Routine name inline text field */}
                <View style={edStyles.headerNameWrapper}>
                  <TextInput
                    style={edStyles.headerNameInput}
                    value={routineName}
                    onChangeText={setRoutineName}
                    placeholder={i18n.t('routineEditor.routineNamePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardAppearance="dark"
                    maxLength={40}
                    textAlign="center"
                    returnKeyType="done"
                  />
                </View>

                <View style={edStyles.headerRight}>
                  <Pressable
                    onPress={handleSave}
                    style={edStyles.saveBtn}
                    android_ripple={rippleTokens.accent}
                    accessibilityLabel={i18n.t('extras.saveRoutineA11y')}
                  >
                    <Ionicons name="checkmark" size={14} color={colors.bg} />
                    <Text style={edStyles.saveBtnText}>{i18n.t('common.save')}</Text>
                  </Pressable>
                </View>
              </View>

              {/* ── Scrollable Body ── */}
              <ScrollView
                style={edStyles.scroll}
                contentContainerStyle={[
                  edStyles.scrollContent,
                  activeInput !== null && { paddingBottom: 280 }
                ]}
                showsVerticalScrollIndicator={false}
                overScrollMode="never"
                keyboardShouldPersistTaps="handled"
              >
                {/* Folder Selector */}
                <View style={edStyles.folderRow}>
                  <Ionicons name="folder-outline" size={14} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
                  <Pressable
                    onPress={() => setIsFolderPickerVisible(v => !v)}
                    style={edStyles.folderPill}
                  >
                    <Text style={edStyles.folderPillText}>
                      {routineFolder || i18n.t('routineEditor.noFolder')}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
                  </Pressable>
                </View>

                {/* Folder Picker Dropdown */}
                {isFolderPickerVisible && (
                  <View style={edStyles.folderDropdown}>
                    {['', ...folders.filter(f => f !== 'All')].map(f => (
                      <Pressable
                        key={f || '__none'}
                        onPress={() => { setRoutineFolder(f); setIsFolderPickerVisible(false); }}
                        style={[edStyles.folderDropdownItem, routineFolder === f && edStyles.folderDropdownItemActive]}
                        android_ripple={rippleTokens.surface}
                      >
                        <Text style={[edStyles.folderDropdownText, routineFolder === f && { color: colors.violet, fontFamily: font.semibold }]}>
                          {f || i18n.t('routineEditor.noFolder')}
                        </Text>
                        {routineFolder === f && <Ionicons name="checkmark" size={14} color={colors.violet} />}
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Routine Notes Input */}
                <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
                  <Text style={{
                    color: colors.textSecondary,
                    fontSize: font.sizes.xs,
                    fontFamily: font.bold,
                    marginBottom: 6,
                    letterSpacing: 0.5,
                  }}>
                    ROUTINE NOTE
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.surface2,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: radius.xs,
                      color: colors.textPrimary,
                      padding: spacing.md,
                      fontSize: font.sizes.sm,
                      fontFamily: font.medium,
                      minHeight: 60,
                      textAlignVertical: 'top',
                    }}
                    placeholder="Enter routine note, seat height settings, or targets..."
                    placeholderTextColor={colors.textMuted}
                    value={routineNotes}
                    onChangeText={setRoutineNotes}
                    multiline
                    keyboardAppearance="dark"
                    maxLength={150}
                  />
                </View>

                {/* Empty State */}
                {editorExercises.length === 0 && (
                  <View style={edStyles.emptyContainer}>
                    <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                    <Text style={edStyles.emptyTitle}>{i18n.t('extras.noExercisesYet')}</Text>
                    <Text style={edStyles.emptySubtitle}>{i18n.t('routineEditor.tapAddExercise')}</Text>
                  </View>
                )}

                {/* Exercise List */}
                {(() => {
                  const superSetColors: Record<string, string> = {};
                  const colorsList = ['#4F8EF7', '#38BDF8', '#6366F1', '#22D97A'];
                  let colorIdx = 0;
                  editorExercises.forEach(ex => {
                    if (ex.superSetGroupId && !superSetColors[ex.superSetGroupId]) {
                      superSetColors[ex.superSetGroupId] = colorsList[colorIdx % colorsList.length];
                      colorIdx++;
                    }
                  });

                  return editorExercises.map((exercise, exIdx) => {
                    const itemKey = exercise.id;
                    const isActive = activeId === itemKey;
                    const dragHandlers = getDragHandlers(itemKey, exIdx);
                    
                    const isSuperSet = !!exercise.superSetGroupId;
                    const nextIsSameSuperSet = isSuperSet && exIdx < editorExercises.length - 1 && editorExercises[exIdx + 1].superSetGroupId === exercise.superSetGroupId;
                    const prevIsSameSuperSet = isSuperSet && exIdx > 0 && editorExercises[exIdx - 1].superSetGroupId === exercise.superSetGroupId;
                    const superSetColor = exercise.superSetGroupId ? (superSetColors[exercise.superSetGroupId] || colors.accent) : undefined;

                    return (
                      <DraggableListItem
                        key={itemKey}
                        itemKey={itemKey}
                        isActive={isActive}
                        dragY={dragY}
                        itemLayouts={itemLayouts}
                      >
                        <SwipeableRow
                          borderRadius={radius.md}
                          style={{ marginBottom: nextIsSameSuperSet ? 0 : spacing.lg }}
                          onDelete={() => {
                            Alert.alert(
                              i18n.t('routineEditor.removeExercise'),
                              i18n.t('routineEditor.removeExerciseMsg', { name: exercise.name }),
                              [
                                { text: i18n.t('common.cancel'), style: 'cancel' },
                                { text: i18n.t('common.remove'), style: 'destructive', onPress: () => {
                                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                  setEditorExercises(prev => {
                                    const filtered = prev.filter((_, i) => i !== exIdx);
                                    return sanitizeSuperSets(filtered);
                                  });
                                }},
                              ]
                            );
                          }}
                        >
                          <ExerciseCard
                            exercise={exercise}
                            exIdx={exIdx}
                            activeInput={activeInput}
                            onFocus={handleSetFocus}
                            updateSetField={updateSetField}
                            deleteSet={deleteSet}
                            inputRefs={inputRefs}
                            mode="editor"
                            superSetColor={superSetColor}
                            isSuperSet={isSuperSet}
                            nextIsSameSuperSet={nextIsSameSuperSet}
                            prevIsSameSuperSet={prevIsSameSuperSet}
                            onMenuPress={(idx) => { setExMenuIdx(idx); setIsExMenuVisible(true); }}
                            onAddSet={addSet}
                            dragHandlers={dragHandlers}
                            tempInputValue={activeInput?.exIdx === exIdx ? tempInputValue : undefined}
                          />
                        </SwipeableRow>
                      </DraggableListItem>
                    );
                  });
                })()}

                {/* Add Exercise Button */}
                <Pressable
                  style={edStyles.addExBtn}
                  onPress={() => setIsAddExerciseVisible(true)}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.accent} style={{ marginRight: spacing.xs }} />
                  <Text style={edStyles.addExBtnText}>{i18n.t('extras.addExerciseBtnRoutine')}</Text>
                </Pressable>

                {/* Save Routine Button */}
                <Pressable
                  style={edStyles.saveRoutineBtn}
                  onPress={handleSave}
                  android_ripple={rippleTokens.accent}
                >
                  <Ionicons name="bookmark-outline" size={18} color={colors.bg} style={{ marginRight: spacing.sm }} />
                  <Text style={edStyles.saveRoutineBtnText}>
                    {isEditing ? i18n.t('routineEditor.saveChanges') : i18n.t('routineEditor.saveRoutine')}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Exercise Context Menu Sheet */}
            {isExMenuVisible && exMenuIdx !== null && (
              <Modal
                visible={isExMenuVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsExMenuVisible(false)}
              >
                <Pressable style={edStyles.sheetBackdrop} onPress={() => setIsExMenuVisible(false)}>
                  <Pressable style={edStyles.sheetCard} onPress={(e) => e.stopPropagation()}>
                    <Text style={edStyles.sheetTitle}>
                      {editorExercises[exMenuIdx]?.name.toUpperCase()}
                    </Text>

                    <Pressable
                      style={edStyles.sheetItem}
                      onPress={() => {
                        setEditorExercises(prev => {
                          const next = [...prev];
                          if (exMenuIdx > 0) {
                            [next[exMenuIdx - 1], next[exMenuIdx]] = [next[exMenuIdx], next[exMenuIdx - 1]];
                          }
                          return sanitizeSuperSets(next);
                        });
                        setIsExMenuVisible(false);
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="arrow-up-outline" size={20} color={colors.accent} />
                      <Text style={edStyles.sheetItemText}>{i18n.t('extras.moveUp')}</Text>
                    </Pressable>

                    <Pressable
                      style={edStyles.sheetItem}
                      onPress={() => {
                        setEditorExercises(prev => {
                          const next = [...prev];
                          if (exMenuIdx < next.length - 1) {
                            [next[exMenuIdx], next[exMenuIdx + 1]] = [next[exMenuIdx + 1], next[exMenuIdx]];
                          }
                          return sanitizeSuperSets(next);
                        });
                        setIsExMenuVisible(false);
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="arrow-down-outline" size={20} color={colors.accent} />
                      <Text style={edStyles.sheetItemText}>{i18n.t('extras.moveDown')}</Text>
                    </Pressable>

                    {(() => {
                      const currentEx = editorExercises[exMenuIdx];
                      if (!currentEx) return null;
                      const isSuperSet = !!currentEx.superSetGroupId;
                      const isLinkedWithNext = isSuperSet && exMenuIdx < editorExercises.length - 1 && editorExercises[exMenuIdx + 1].superSetGroupId === currentEx.superSetGroupId;
                      const isLinkedWithPrev = isSuperSet && exMenuIdx > 0 && editorExercises[exMenuIdx - 1].superSetGroupId === currentEx.superSetGroupId;

                      return (
                        <>
                          {isSuperSet && (
                            <Pressable
                              style={edStyles.sheetItem}
                              onPress={() => {
                                setEditorExercises(prev => {
                                  const unlinked = prev.map((ex, idx) => 
                                    idx === exMenuIdx ? { ...ex, superSetGroupId: undefined } : ex
                                  );
                                  return sanitizeSuperSets(unlinked);
                                });
                                setIsExMenuVisible(false);
                              }}
                              android_ripple={rippleTokens.surface}
                            >
                              <Ionicons name="link-outline" size={20} color={colors.accent} />
                              <Text style={edStyles.sheetItemText}>{i18n.t('extras.unlinkSuperSet')}</Text>
                            </Pressable>
                          )}

                          {exMenuIdx < editorExercises.length - 1 && !isLinkedWithNext && (
                            <Pressable
                              style={edStyles.sheetItem}
                              onPress={() => {
                                setEditorExercises(prev => {
                                  const idxA = exMenuIdx;
                                  const idxB = exMenuIdx + 1;
                                  const gidA = prev[idxA].superSetGroupId;
                                  const gidB = prev[idxB].superSetGroupId;
                                  const targetGid = gidA || gidB || `ss-${Date.now()}`;
                                  
                                  const linked = prev.map((ex, idx) => {
                                    if (idx === idxA || idx === idxB) {
                                      return { ...ex, superSetGroupId: targetGid };
                                    }
                                    if (gidA && gidB && gidA !== gidB && ex.superSetGroupId === gidB) {
                                      return { ...ex, superSetGroupId: targetGid };
                                    }
                                    return ex;
                                  });
                                  return sanitizeSuperSets(linked);
                                });
                                setIsExMenuVisible(false);
                              }}
                              android_ripple={rippleTokens.surface}
                            >
                              <Ionicons name="link-outline" size={20} color={colors.accent} />
                              <Text style={edStyles.sheetItemText}>{i18n.t('extras.linkWithNext')}</Text>
                            </Pressable>
                          )}

                          {exMenuIdx > 0 && !isLinkedWithPrev && (
                            <Pressable
                              style={edStyles.sheetItem}
                              onPress={() => {
                                setEditorExercises(prev => {
                                  const idxA = exMenuIdx;
                                  const idxB = exMenuIdx - 1;
                                  const gidA = prev[idxA].superSetGroupId;
                                  const gidB = prev[idxB].superSetGroupId;
                                  const targetGid = gidA || gidB || `ss-${Date.now()}`;
                                  
                                  const linked = prev.map((ex, idx) => {
                                    if (idx === idxA || idx === idxB) {
                                      return { ...ex, superSetGroupId: targetGid };
                                    }
                                    if (gidA && gidB && gidA !== gidB && ex.superSetGroupId === gidB) {
                                      return { ...ex, superSetGroupId: targetGid };
                                    }
                                    return ex;
                                  });
                                  return sanitizeSuperSets(linked);
                                });
                                setIsExMenuVisible(false);
                              }}
                              android_ripple={rippleTokens.surface}
                            >
                              <Ionicons name="link-outline" size={20} color={colors.accent} />
                              <Text style={edStyles.sheetItemText}>{i18n.t('extras.linkWithPrevious')}</Text>
                            </Pressable>
                          )}
                        </>
                      );
                    })()}

                    <Pressable
                      style={edStyles.sheetItem}
                      onPress={() => {
                        Alert.alert(
                           i18n.t('routineEditor.removeExercise'),
                           i18n.t('routineEditor.removeExerciseMsg', { name: editorExercises[exMenuIdx]?.name }),
                           [
                             { text: i18n.t('common.cancel'), style: 'cancel' },
                             { text: i18n.t('common.remove'), style: 'destructive', onPress: () => {
                               setEditorExercises(prev => {
                                 const filtered = prev.filter((_, i) => i !== exMenuIdx);
                                 return sanitizeSuperSets(filtered);
                               });
                               setIsExMenuVisible(false);
                             }},
                           ]
                        );
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                      <Text style={[edStyles.sheetItemText, { color: colors.error }]}>{i18n.t('routineEditor.removeExercise')}</Text>
                    </Pressable>

                    <Pressable
                      style={[edStyles.sheetItem, edStyles.sheetCancel]}
                      onPress={() => setIsExMenuVisible(false)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={edStyles.sheetCancelText}>{i18n.t('common.cancel')}</Text>
                    </Pressable>
                  </Pressable>
                </Pressable>
              </Modal>
            )}
            {/* Unsaved Changes Confirmation Modal */}
            <Modal
              visible={isDiscardConfirmVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setIsDiscardConfirmVisible(false)}
            >
              <Pressable 
                style={edStyles.confirmBackdrop} 
                onPress={() => setIsDiscardConfirmVisible(false)}
              >
                <Pressable 
                  style={edStyles.confirmCard} 
                  onPress={e => e.stopPropagation()}
                >
                  <Text style={edStyles.confirmTitle}>{i18n.t('extras.discardChanges')}</Text>
                  <Text style={edStyles.confirmMessage}>
                    {i18n.t('extras.discardChangesMsg')}
                  </Text>
                  <View style={edStyles.confirmActions}>
                    <Pressable
                      onPress={() => {
                        setIsDiscardConfirmVisible(false);
                        onClose();
                      }}
                      style={[edStyles.confirmBtn, edStyles.confirmBtnYes]}
                      android_ripple={rippleTokens.borderless}
                    >
                      <Text style={edStyles.confirmBtnTextYes}>{i18n.t('extras.areYouSure')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setIsDiscardConfirmVisible(false)}
                      style={[edStyles.confirmBtn, edStyles.confirmBtnStay]}
                      android_ripple={rippleTokens.borderless}
                    >
                      <Text style={edStyles.confirmBtnTextStay}>{i18n.t('extras.stayBtn')}</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>

            <CustomWorkoutKeyboard
              visible={activeInput !== null}
              inputKey={activeInput ? `${activeInput.exIdx}-${activeInput.setIdx}-${activeInput.fieldName}-${activeInput.focusTime || 0}` : ''}
              value={tempInputValue}
              onChange={(newValue) => {
                setTempInputValue(newValue);
                tempInputValueRef.current = newValue;
              }}
              fieldName={activeInput?.fieldName}
              title={activeInput ? editorExercises[activeInput.exIdx]?.name : ''}
              onNext={handleNextField}
              onClose={handleCloseKeyboard}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Global Add Exercise Screen */}
      <AddExerciseScreen
        visible={isAddExerciseVisible}
        exercises={exercises}
        onConfirm={handleConfirmExercises}
        onClose={() => setIsAddExerciseVisible(false)}
        onAddCustomExercise={onAddCustomExercise}
        title={i18n.t('routineEditor.addExercises')}
        sessions={sessions}
        exerciseNameLanguage={exerciseNameLanguage}
      />
    </>
  );
};

export default RoutineEditorModal;

// ─── Styles ───────────────────────────────────────────────────────────────────
const edStyles = StyleSheet.create({
  keyboardAvoid: { flex: 1, backgroundColor: colors.bg },
  safe:          { flex: 1, backgroundColor: colors.bg },
  container:     { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    height:            56,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  backBtn:     { padding: spacing.xs },

  headerNameWrapper: {
    flex:       1,
    marginHorizontal: spacing.sm,
  },
  headerNameInput: {
    color:           colors.textPrimary,
    fontSize:        font.sizes.base,
    fontFamily:      font.semibold,
    backgroundColor: 'transparent',
    padding:         0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom:   4,
  },

  saveBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    columnGap:         6,
    backgroundColor:   colors.violet,
    borderRadius:      radius.full,
    paddingVertical:   7,
    paddingHorizontal: spacing.md,
  },
  saveBtnText: {
    color:         colors.bg,
    fontSize:      font.sizes.sm,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.lg },

  // Folder row
  folderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   spacing.lg,
  },
  folderPill: {
    flexDirection:     'row',
    alignItems:        'center',
    columnGap:         spacing.xs,
    backgroundColor:   colors.surface2,
    borderWidth:       1,
    borderColor:       colors.border,
    borderRadius:      radius.full,
    paddingVertical:   4,
    paddingHorizontal: spacing.md,
  },
  folderPillText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.xs,
    fontFamily: font.medium,
  },
  folderDropdown: {
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    marginBottom:    spacing.lg,
    overflow:        'hidden',
    ...(shadow.card as object),
  },
  folderDropdownItem: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  folderDropdownItemActive: {
    backgroundColor: colors.violet + '12',
  },
  folderDropdownText: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.medium,
  },

  // Empty state
  emptyContainer: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 72,
    rowGap:          spacing.md,
  },
  emptyTitle: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.lg,
    fontFamily: font.semibold,
  },
  emptySubtitle: {
    color:      colors.textMuted,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
    textAlign:  'center',
    maxWidth:   260,
  },

  // Exercise card
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    ...(shadow.sm as object),
  },
  exerciseHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  exerciseName: {
    flex:       1,
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
  },
  exEllipsis: {
    padding:     spacing.xs,
    marginRight: -4,
  },
  dragHandle: {
    padding: 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
  },
  columnLabel: {
    color:      colors.textSecondary,
    fontSize:   10,
    fontFamily: font.semibold,
  },
  colSet:    { width: 45, textAlign: 'center' },
  colWeight: { flex: 1.2, marginRight: spacing.sm },
  colReps:   { flex: 1,   marginRight: spacing.sm },

  // Set Row
  setRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  setNumCol: {
    height:         32,
    justifyContent: 'center',
    alignItems:     'center',
  },
  setNumText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.semibold,
  },
  inputWrapper: { height: 32 },
  input: {
    flex:            1,
    backgroundColor: colors.surface2,
    borderColor:     colors.border,
    borderWidth:     1,
    borderRadius:    radius.xs,
    color:           colors.textPrimary,
    textAlign:       'center',
    fontSize:        font.sizes.sm,
    fontFamily:      'monospace',
    padding:         0,
  },
  setDeleteBtn: {
    width:          32,
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Add Set Row
  addSetRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    columnGap:       4,
    paddingVertical: spacing.sm,
    marginTop:       spacing.xs,
    borderColor:     colors.border,
    borderTopWidth:  1,
    borderStyle:     'dashed',
  },
  addSetText: {
    color:      colors.accent,
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
  },

  // Add Exercise Button
  addExBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.bg,
    borderColor:     colors.accent + '60',
    borderWidth:     1,
    borderStyle:     'dashed',
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    marginBottom:    spacing.md,
  },
  addExBtnText: {
    color:         colors.accent,
    fontSize:      font.sizes.sm,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },

  // Save Routine Button
  saveRoutineBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.violet,
    borderRadius:    radius.md,
    paddingVertical: spacing.lg,
    marginBottom:    spacing.xl,
    ...(shadow.lg as object),
  },
  saveRoutineBtnText: {
    color:         colors.bg,
    fontSize:      font.sizes.base,
    fontFamily:    font.bold,
    letterSpacing: 1,
  },

  // Swipe-to-delete background
  swipeDeleteBg: {
    position:       'absolute',
    top:            0,
    bottom:         0,
    right:          0,
    left:           0,
    backgroundColor: colors.error,
    justifyContent:  'center',
    alignItems:      'flex-end',
    paddingRight:    spacing.lg,
  },

  // Exercise Context Menu Sheet
  sheetBackdrop: {
    flex:             1,
    backgroundColor:  'rgba(5, 7, 10, 0.5)',
    justifyContent:   'flex-end',
  },
  sheetCard: {
    backgroundColor:     colors.surface,
    borderColor:         colors.border,
    borderTopWidth:      1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding:             24,
    rowGap:              spacing.md,
  },
  sheetTitle: {
    color:         colors.textSecondary,
    fontSize:      font.sizes.xs,
    fontFamily:    font.bold,
    letterSpacing: 1,
    marginBottom:  spacing.xs,
  },
  sheetItem: {
    flexDirection:   'row',
    alignItems:      'center',
    columnGap:       spacing.md,
    paddingVertical: spacing.md,
  },
  sheetItemText: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md,
    fontFamily: font.semibold,
  },
  sheetCancel: {
    marginTop:     spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop:    spacing.lg,
    alignItems:    'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
  },

  // Super Set styling
  superSetBadge: {
    paddingVertical:   2,
    paddingHorizontal: 6,
    borderRadius:      radius.xs - 2,
    borderWidth:       1,
  },
  superSetBadgeText: {
    fontSize:   8,
    fontFamily: font.bold,
  },

  // Unsaved Changes Confirmation Dialog
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    ...(shadow.card as object),
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    columnGap: spacing.md,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnYes: {
    backgroundColor: colors.error,
  },
  confirmBtnStay: {
    backgroundColor: colors.accent,
  },
  confirmBtnTextYes: {
    color: '#FFFFFF',
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  confirmBtnTextStay: {
    color: '#FFFFFF',
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },

  // Unilateral Row Styling
  unilateralSetRow: {
    flexDirection:   'row',
    alignItems:      'stretch',
    paddingVertical: 0,
    borderRadius:    radius.xs,
    backgroundColor: colors.surface,
  },
  unilateralContainer: {
    flex:            1,
    flexDirection:   'column',
    gap:             2,
    paddingVertical: 4,
  },
  unilateralRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
  },
  unilateralLabel: {
    width:           20,
    color:           colors.textSecondary,
    fontSize:        font.sizes.xs,
    fontFamily:      font.bold,
    textAlign:       'center',
  },
  unilateralInputWrapper: {
    flex:            1,
    height:          28,
  },
  unilateralInput: {
    flex:            1,
    backgroundColor: colors.surface2,
    borderColor:     colors.border,
    borderWidth:     1,
    borderRadius:    radius.xs,
    color:           colors.textPrimary,
    textAlign:       'center',
    fontSize:        font.sizes.sm,
    fontFamily:      'monospace',
    padding:         0,
  },
});
