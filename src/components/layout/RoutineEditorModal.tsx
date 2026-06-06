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
  Animated,
  PanResponder,
  Vibration,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../../theme';
import { Exercise } from '../../data/mockData';
import IconButton from '../ui/IconButton';
import AddExerciseScreen from '../../screens/AddExerciseScreen';
import { CustomWorkoutKeyboard } from '../ui/CustomWorkoutKeyboard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SetRecord {
  id:        string;
  weight:    string;
  reps:      string;
  category?: 'W' | 'S' | 'D' | 'F';
}

interface RoutineExercise {
  id: string;
  name: string;
  sets: SetRecord[];
}

export interface RoutineEditorModalProps {
  visible:               boolean;
  initialName?:          string;
  initialExercises?:     string[];
  initialFolder?:        string;
  editingId?:            string | null;
  exercises:             Exercise[];
  folders:               string[];
  onSave:                (name: string, exerciseNames: string[], folder?: string) => void;
  onClose:               () => void;
  onAddCustomExercise?:  (name: string, muscle: string, equipment: string) => any;
}

// ─── SwipeableRow (same pattern as ActiveWorkoutModal) ────────────────────────
const SwipeableRow: React.FC<{
  children:     React.ReactNode;
  onDelete:     () => void;
  borderRadius?: number;
  style?:        any;
}> = ({ children, onDelete, borderRadius = radius.xs, style }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dy) < 8,
      onPanResponderMove: (_, gs) => {
        let newX = gs.dx;
        if (isOpen.current) {
          newX = -70 + gs.dx;
        }
        if (newX > 0) newX = 0;
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gs) => {
        const threshold = isOpen.current ? -30 : -45;
        if (gs.dx < threshold) {
          Animated.spring(translateX, {
            toValue: -70,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
          }).start(() => {
            isOpen.current = true;
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
          }).start(() => {
            isOpen.current = false;
          });
        }
      },
    })
  ).current;

  const handleDeletePress = () => {
    if (Platform.OS !== 'web') Vibration.vibrate(15);
    Animated.timing(translateX, {
      toValue: -500,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
      translateX.setValue(0);
      isOpen.current = false;
    });
  };

  const handleOverlayPress = () => {
    if (isOpen.current) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }).start(() => {
        isOpen.current = false;
      });
    }
  };

  const underlayOpacity = translateX.interpolate({
    inputRange: [-10, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[{ position: 'relative', overflow: 'hidden', borderRadius }, style]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: underlayOpacity }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDeletePress}
        >
          <View style={[edStyles.swipeDeleteBg, { borderRadius }]}>
            <Ionicons name="trash-outline" size={18} color="#FFF" />
          </View>
        </Pressable>
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
        onTouchStart={handleOverlayPress}
      >
        {children}
      </Animated.View>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  visible,
  initialName = '',
  initialExercises = [],
  initialFolder = '',
  editingId = null,
  exercises,
  folders,
  onSave,
  onClose,
  onAddCustomExercise,
}) => {
  const [routineName,  setRoutineName]  = useState(initialName);
  const [routineFolder, setRoutineFolder] = useState(initialFolder);
  const [editorExercises, setEditorExercises] = useState<RoutineExercise[]>([]);
  const [isAddExerciseVisible, setIsAddExerciseVisible] = useState(false);
  const [isFolderPickerVisible, setIsFolderPickerVisible] = useState(false);

  const [activeInput, setActiveInput] = useState<{
    exIdx: number;
    setIdx: number;
    fieldName: 'weight' | 'reps';
  } | null>(null);

  const inputRefs = useRef<{ [key: string]: any }>({});

  // Drag state
  const dragY         = useRef(new Animated.Value(0)).current;
  const dragIdx       = useRef(-1);
  const hoverIdx      = useRef(-1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemLayouts   = useRef<{ [key: string]: { y: number; height: number } }>({});

  // Exercise context menu
  const [exMenuIdx,     setExMenuIdx]     = useState<number | null>(null);
  const [isExMenuVisible, setIsExMenuVisible] = useState(false);

  // Reset whenever modal opens/closes
  useEffect(() => {
    if (visible) {
      setRoutineName(initialName || '');
      setRoutineFolder(initialFolder || '');
      setEditorExercises(
        initialExercises.map((name, idx) => ({
          id: `ex-${idx}-${Date.now()}-${Math.random()}`,
          name,
          sets: [
            { id: `s-${idx}-0-${Date.now()}`, weight: '0', reps: '0', category: 'S' },
            { id: `s-${idx}-1-${Date.now()}`, weight: '0', reps: '0', category: 'S' },
            { id: `s-${idx}-2-${Date.now()}`, weight: '0', reps: '0', category: 'S' },
          ],
        }))
      );
      setActiveId(null);
      dragY.setValue(0);
    }
  }, [visible]);

  // ── Set helpers ──────────────────────────────────────────────────────────────
  const addSet = useCallback((exIdx: number) => {
    setEditorExercises(prev => {
      const next = [...prev];
      const last = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx].sets = [
        ...next[exIdx].sets,
        {
          id:       `s-${exIdx}-${Date.now()}`,
          weight:   last?.weight ?? '0',
          reps:     last?.reps   ?? '10',
          category: 'S',
        },
      ];
      return next;
    });
  }, []);

  const deleteSet = useCallback((exIdx: number, setIdx: number) => {
    setEditorExercises(prev => {
      const next = [...prev];
      next[exIdx].sets = next[exIdx].sets.filter((_, i) => i !== setIdx);
      return next;
    });
  }, []);

  const updateSetField = useCallback((exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setEditorExercises(prev => {
      const next = [...prev];
      (next[exIdx].sets[setIdx] as any)[field] = value;
      return next;
    });
  }, []);

  // Handle custom keyboard "Next" button click
  const handleNextField = useCallback(() => {
    if (!activeInput) return;
    const { exIdx, setIdx, fieldName } = activeInput;

    if (fieldName === 'weight') {
      const nextKey = `${exIdx}-${setIdx}-reps`;
      setActiveInput({ exIdx, setIdx, fieldName: 'reps' });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    const currentEx = editorExercises[exIdx];
    if (currentEx && setIdx < currentEx.sets.length - 1) {
      const nextKey = `${exIdx}-${setIdx + 1}-weight`;
      setActiveInput({ exIdx, setIdx: setIdx + 1, fieldName: 'weight' });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    if (exIdx < editorExercises.length - 1) {
      const nextKey = `${exIdx + 1}-0-weight`;
      setActiveInput({ exIdx: exIdx + 1, setIdx: 0, fieldName: 'weight' });
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
      }
      return;
    }

    setActiveInput(null);
  }, [activeInput, editorExercises]);

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

  const getDragHandlers = useCallback((itemKey: string, index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        setActiveId(itemKey);
        dragIdx.current   = index;
        hoverIdx.current  = index;
        dragY.setValue(0);
        if (Platform.OS !== 'web') Vibration.vibrate(20);
      },
      onPanResponderMove: (_, gs) => {
        dragY.setValue(gs.dy);
        handleMove(gs.dy);
      },
      onPanResponderRelease: () => {
        setActiveId(null);
        dragIdx.current  = -1;
        hoverIdx.current = -1;
        dragY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setActiveId(null);
        dragIdx.current  = -1;
        hoverIdx.current = -1;
        dragY.setValue(0);
      },
    }).panHandlers;
  }, [handleMove, dragY]);

  // ── Add exercises callback ────────────────────────────────────────────────────
  const handleSetFocus = useCallback((ex: number, s: number, field: 'weight' | 'reps') => {
    setActiveInput({ exIdx: ex, setIdx: s, fieldName: field });
  }, []);

  const handleConfirmExercises = (names: string[]) => {
    setEditorExercises(prev => [
      ...prev,
      ...names.map((name, idx) => ({
        id: `ex-new-${idx}-${Date.now()}-${Math.random()}`,
        name,
        sets: [
          { id: `s-new-${idx}-0-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const },
          { id: `s-new-${idx}-1-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const },
          { id: `s-new-${idx}-2-${Date.now()}`, weight: '0', reps: '10', category: 'S' as const },
        ],
      })),
    ]);
    setIsAddExerciseVisible(false);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!routineName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your routine.');
      return;
    }
    if (editorExercises.length === 0) {
      Alert.alert('No Exercises', 'Please add at least one exercise to your routine.');
      return;
    }
    const folderVal = routineFolder.trim() || undefined;
    onSave(routineName.trim(), editorExercises.map(ex => ex.name), folderVal);
    onClose();
  };

  const isEditing = !!editingId;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={edStyles.keyboardAvoid}
        >
          <SafeAreaView style={edStyles.safe} edges={['top', 'bottom']}>
            <View style={edStyles.container}>

              {/* ── Header ── */}
              <View style={edStyles.header}>
                <View style={edStyles.headerLeft}>
                  <Pressable
                    onPress={onClose}
                    style={edStyles.backBtn}
                    android_ripple={rippleTokens.borderless}
                    accessibilityLabel="Close routine editor"
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
                    placeholder="Routine Name..."
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
                    accessibilityLabel="Save routine"
                  >
                    <Ionicons name="checkmark" size={14} color={colors.bg} />
                    <Text style={edStyles.saveBtnText}>SAVE</Text>
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
                      {routineFolder || 'No Folder'}
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
                          {f || 'No Folder'}
                        </Text>
                        {routineFolder === f && <Ionicons name="checkmark" size={14} color={colors.violet} />}
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Empty State */}
                {editorExercises.length === 0 && (
                  <View style={edStyles.emptyContainer}>
                    <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                    <Text style={edStyles.emptyTitle}>No exercises yet</Text>
                    <Text style={edStyles.emptySubtitle}>Tap "Add Exercise" below to build your routine</Text>
                  </View>
                )}

                {/* Exercise List */}
                {editorExercises.map((exercise, exIdx) => {
                  const itemKey = exercise.id;
                  const isActive = activeId === itemKey;
                  const dragHandlers = getDragHandlers(itemKey, exIdx);

                  return (
                    <Animated.View
                      key={itemKey}
                      onLayout={e => {
                        if (!isActive) {
                          itemLayouts.current[itemKey] = {
                            y: e.nativeEvent.layout.y,
                            height: e.nativeEvent.layout.height,
                          };
                        }
                      }}
                      style={[
                        isActive && {
                          transform:       [{ translateY: dragY }],
                          zIndex:          999,
                          opacity:         0.88,
                          shadowColor:     '#000',
                          shadowOffset:    { width: 0, height: 8 },
                          shadowOpacity:   0.55,
                          shadowRadius:    16,
                          elevation:       14,
                        },
                      ]}
                    >
                      <SwipeableRow
                        borderRadius={radius.md}
                        style={{ marginBottom: spacing.lg }}
                        onDelete={() => {
                          Alert.alert(
                            'Remove Exercise',
                            `Remove "${exercise.name}" from this routine?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Remove', style: 'destructive', onPress: () =>
                                setEditorExercises(prev => prev.filter((_, i) => i !== exIdx))
                              },
                            ]
                          );
                        }}
                      >
                        <View style={edStyles.exerciseCard}>
                          {/* Exercise Header */}
                          <View style={edStyles.exerciseHeader}>
                            <Text style={edStyles.exerciseName} numberOfLines={1}>
                              {exercise.name}
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm }}>
                              {/* Ellipsis menu */}
                              <Pressable
                                onPress={() => { setExMenuIdx(exIdx); setIsExMenuVisible(true); }}
                                style={edStyles.exEllipsis}
                                android_ripple={rippleTokens.borderless}
                              >
                                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                              </Pressable>

                              {/* Drag Handle (long press activates) */}
                              <Pressable
                                {...dragHandlers}
                                style={edStyles.dragHandle}
                                android_ripple={rippleTokens.borderless}
                                accessibilityLabel="Drag to reorder"
                              >
                                <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
                              </Pressable>
                            </View>
                          </View>

                          {/* Table Header */}
                          <View style={edStyles.tableHeader}>
                            <Text style={[edStyles.columnLabel, edStyles.colSet]}>SET</Text>
                            <Text style={[edStyles.columnLabel, edStyles.colWeight, { textAlign: 'center' }]}>KG</Text>
                            <Text style={[edStyles.columnLabel, edStyles.colReps, { textAlign: 'center' }]}>REPS</Text>
                            <View style={{ width: 32 }} />
                          </View>

                          {/* Sets */}
                          {exercise.sets.map((set, setIdx) => (
                            <RoutineSetRowItem
                              key={set.id}
                              set={set}
                              setIdx={setIdx}
                              exIdx={exIdx}
                              activeInput={activeInput}
                              onFocus={handleSetFocus}
                              updateSetField={updateSetField}
                              deleteSet={deleteSet}
                              inputRefs={inputRefs}
                            />
                          ))}

                          {/* Add Set */}
                          <Pressable
                            style={edStyles.addSetRow}
                            onPress={() => addSet(exIdx)}
                            android_ripple={rippleTokens.surface}
                          >
                            <Ionicons name="add" size={16} color={colors.accent} />
                            <Text style={edStyles.addSetText}>ADD SET</Text>
                          </Pressable>
                        </View>
                      </SwipeableRow>
                    </Animated.View>
                  );
                })}

                {/* Add Exercise Button */}
                <Pressable
                  style={edStyles.addExBtn}
                  onPress={() => setIsAddExerciseVisible(true)}
                  android_ripple={rippleTokens.surface}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.accent} style={{ marginRight: spacing.xs }} />
                  <Text style={edStyles.addExBtnText}>ADD EXERCISE</Text>
                </Pressable>

                {/* Save Routine Button */}
                <Pressable
                  style={edStyles.saveRoutineBtn}
                  onPress={handleSave}
                  android_ripple={rippleTokens.accent}
                >
                  <Ionicons name="bookmark-outline" size={18} color={colors.bg} style={{ marginRight: spacing.sm }} />
                  <Text style={edStyles.saveRoutineBtnText}>
                    {isEditing ? 'SAVE CHANGES' : 'SAVE ROUTINE'}
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
                  <View style={edStyles.sheetCard}>
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
                          return next;
                        });
                        setIsExMenuVisible(false);
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="arrow-up-outline" size={20} color={colors.accent} />
                      <Text style={edStyles.sheetItemText}>Move Up</Text>
                    </Pressable>

                    <Pressable
                      style={edStyles.sheetItem}
                      onPress={() => {
                        setEditorExercises(prev => {
                          const next = [...prev];
                          if (exMenuIdx < next.length - 1) {
                            [next[exMenuIdx], next[exMenuIdx + 1]] = [next[exMenuIdx + 1], next[exMenuIdx]];
                          }
                          return next;
                        });
                        setIsExMenuVisible(false);
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="arrow-down-outline" size={20} color={colors.accent} />
                      <Text style={edStyles.sheetItemText}>Move Down</Text>
                    </Pressable>

                    <Pressable
                      style={edStyles.sheetItem}
                      onPress={() => {
                        Alert.alert(
                          'Remove Exercise',
                          `Remove "${editorExercises[exMenuIdx]?.name}" from this routine?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => {
                              setEditorExercises(prev => prev.filter((_, i) => i !== exMenuIdx));
                              setIsExMenuVisible(false);
                            }},
                          ]
                        );
                      }}
                      android_ripple={rippleTokens.surface}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                      <Text style={[edStyles.sheetItemText, { color: colors.error }]}>Remove Exercise</Text>
                    </Pressable>

                    <Pressable
                      style={[edStyles.sheetItem, edStyles.sheetCancel]}
                      onPress={() => setIsExMenuVisible(false)}
                      android_ripple={rippleTokens.surface}
                    >
                      <Text style={edStyles.sheetCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Modal>
            )}
            <CustomWorkoutKeyboard
              visible={activeInput !== null}
              value={
                activeInput
                  ? editorExercises[activeInput.exIdx]?.sets[activeInput.setIdx]?.[activeInput.fieldName] || ''
                  : ''
              }
              onChange={(newValue) => {
                if (activeInput) {
                  updateSetField(activeInput.exIdx, activeInput.setIdx, activeInput.fieldName, newValue);
                }
              }}
              fieldName={activeInput?.fieldName}
              title={activeInput ? editorExercises[activeInput.exIdx]?.name : ''}
              onNext={handleNextField}
              onClose={() => setActiveInput(null)}
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Global Add Exercise Screen */}
      <AddExerciseScreen
        visible={isAddExerciseVisible}
        exercises={exercises}
        onConfirm={handleConfirmExercises}
        onClose={() => setIsAddExerciseVisible(false)}
        onAddCustomExercise={onAddCustomExercise}
        title="ADD EXERCISES"
      />
    </>
  );
};

interface RoutineSetRowItemProps {
  set: SetRecord;
  setIdx: number;
  exIdx: number;
  activeInput: { exIdx: number; setIdx: number; fieldName: 'weight' | 'reps' } | null;
  onFocus: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps') => void;
  updateSetField: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps', value: string) => void;
  deleteSet: (exIdx: number, setIdx: number) => void;
  inputRefs: React.MutableRefObject<{ [key: string]: any }>;
}

const RoutineSetRowItem: React.FC<RoutineSetRowItemProps> = React.memo(({
  set,
  setIdx,
  exIdx,
  activeInput,
  onFocus,
  updateSetField,
  deleteSet,
  inputRefs,
}) => {
  const isWeightFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'weight';
  const isRepsFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'reps';

  return (
    <SwipeableRow onDelete={() => deleteSet(exIdx, setIdx)} borderRadius={radius.xs} style={{ marginBottom: 4 }}>
      <View style={edStyles.setRow}>
        {/* Set Number */}
        <View style={[edStyles.colSet, edStyles.setNumCol]}>
          <Text style={edStyles.setNumText}>{setIdx + 1}</Text>
        </View>

        {/* Weight */}
        <View style={[edStyles.colWeight, edStyles.inputWrapper]}>
          <TextInput
            ref={r => { inputRefs.current[`${exIdx}-${setIdx}-weight`] = r; }}
            style={[
              edStyles.input,
              isWeightFocused && { borderColor: colors.accent },
            ]}
            showSoftInputOnFocus={false}
            keyboardType="numeric"
            value={set.weight}
            onFocus={() => onFocus(exIdx, setIdx, 'weight')}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
        </View>

        {/* Reps */}
        <View style={[edStyles.colReps, edStyles.inputWrapper]}>
          <TextInput
            ref={r => { inputRefs.current[`${exIdx}-${setIdx}-reps`] = r; }}
            style={[
              edStyles.input,
              isRepsFocused && { borderColor: colors.accent },
            ]}
            showSoftInputOnFocus={false}
            keyboardType="numeric"
            value={set.reps}
            onFocus={() => onFocus(exIdx, setIdx, 'reps')}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
        </View>

        {/* Delete icon (quick tap) */}
        <Pressable
          style={edStyles.setDeleteBtn}
          onPress={() => deleteSet(exIdx, setIdx)}
          android_ripple={rippleTokens.borderless}
        >
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </SwipeableRow>
  );
});

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
    padding: spacing.xs,
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
});
