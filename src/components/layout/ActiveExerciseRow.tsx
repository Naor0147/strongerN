import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, cancelAnimation, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Sortable from 'react-native-sortables';
import { colors, spacing, ripple as rippleTokens } from '../../theme';
import { styles } from './activeWorkoutStyles';
import { VariationDropdown } from '../ui/VariationDropdown';
import { ActiveSetRowItem } from './ActiveSetRowItem';

import i18n from '../../utils/i18n';

export interface ActiveExerciseRowProps {
  exercise: any;
  exIdx: number;
  exItemKey: string;
  isSuperSet: boolean;
  nextIsSameSuperSet: boolean;
  prevIsSameSuperSet: boolean;
  superSetColor: string | undefined;
  handleExerciseMenuPress: (idx: number) => void;
  handleOpenExerciseInsights?: (idx: number) => void;
  handleSelectVariation?: (exIdx: number, variation: string | undefined) => void;
  exerciseLibraryMap: Map<string, any>;
  handleSetFocus: any;
  updateSetField: any;
  deleteSet: any;
  toggleSetComplete: any;
  inputRefs: any;
  isRpeMode: boolean;
  addSet: (idx: number, unilateral?: boolean) => void;
  updateExerciseNote?: (exIdx: number, note: string | undefined) => void;
  onSaveLibraryNote?: (exerciseName: string, note: string | undefined) => void;
}

export const ActiveExerciseRow: React.FC<ActiveExerciseRowProps> = React.memo(({
  exercise,
  exIdx,
  exItemKey,
  isSuperSet,
  nextIsSameSuperSet,
  prevIsSameSuperSet,
  superSetColor,
  handleExerciseMenuPress,
  handleOpenExerciseInsights,
  handleSelectVariation,
  exerciseLibraryMap,
  handleSetFocus,
  updateSetField,
  deleteSet,
  toggleSetComplete,
  inputRefs,
  isRpeMode,
  addSet,
  updateExerciseNote,
  onSaveLibraryNote,
}) => {
  const enterScale = useSharedValue(0.95);
  const enterOpacity = useSharedValue(0);
  const enterTranslateY = useSharedValue(20);

  const libEx = exercise.name ? exerciseLibraryMap.get(exercise.name.toLowerCase()) : undefined;
  const initialNote = exercise.note !== undefined ? exercise.note : (libEx?.notes || '');
  const [localNote, setLocalNote] = useState(initialNote);
  const [isEditingNote, setIsEditingNote] = useState(false);

  useEffect(() => {
    setLocalNote(exercise.note !== undefined ? exercise.note : (libEx?.notes || ''));
  }, [exercise.note, libEx?.notes]);

  const hasEnteredRef = useRef(false);
  useEffect(() => {
    if (hasEnteredRef.current) return;
    hasEnteredRef.current = true;

    enterScale.value = withDelay(
      exIdx * 75,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) })
    );
    enterOpacity.value = withDelay(
      exIdx * 75,
      withTiming(1, { duration: 300 })
    );
    enterTranslateY.value = withDelay(
      exIdx * 75,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) })
    );
    return () => {
      cancelAnimation(enterScale);
      cancelAnimation(enterOpacity);
      cancelAnimation(enterTranslateY);
    };
  }, []);

  const [renderedSetsLimit, setRenderedSetsLimit] = useState(4);

  useEffect(() => {
    if (exercise.sets.length > renderedSetsLimit) {
      const animId = requestAnimationFrame(() => {
        setRenderedSetsLimit(prev => Math.min(exercise.sets.length, prev + 8));
      });
      return () => cancelAnimationFrame(animId);
    }
  }, [exercise.sets.length, renderedSetsLimit]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: enterTranslateY.value },
        { scale: enterScale.value }
      ],
      opacity: enterOpacity.value,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <View style={[
        styles.exerciseCard,
        isSuperSet && {
          borderLeftWidth: 4,
          borderLeftColor: superSetColor,
        },
        nextIsSameSuperSet && {
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottomWidth: 0,
        },
        prevIsSameSuperSet && {
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }
      ]}>
          <View style={styles.exerciseHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm, flex: 1 }}>
              <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs }}>
              {(() => {
                const libEx = exercise.name ? exerciseLibraryMap.get(exercise.name.toLowerCase()) : undefined;
                const variationsList = libEx?.variations || [];
                if (variationsList.length > 0 || exercise.variation) {
                  return (
                    <VariationDropdown
                      variations={variationsList}
                      activeVariation={exercise.variation}
                      onSelectVariation={(v) => handleSelectVariation && handleSelectVariation(exIdx, v)}
                      onManageVariations={() => handleOpenExerciseInsights ? handleOpenExerciseInsights(exIdx) : handleExerciseMenuPress(exIdx)}
                    />
                  );
                }
                return null;
              })()}
              <Pressable
                onPress={() => handleExerciseMenuPress(exIdx)}
                style={styles.exEllipsis}
                android_ripple={rippleTokens.borderless}
                testID={`ex-ellipsis-${exIdx}`}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </Pressable>
              <Sortable.Handle style={styles.dragHandle}>
                <Ionicons name="reorder-three" size={22} color={colors.textSecondary} accessibilityLabel="Drag to reorder exercise" />
              </Sortable.Handle>
            </View>
          </View>

          {/* Inline Exercise Note Editor */}
          <View style={styles.notesContainer}>
            <Ionicons name="document-text-outline" size={14} color={colors.accent} />
            <TextInput
              style={[styles.notesText, { color: colors.textPrimary, paddingVertical: 0 }]}
              placeholder={i18n.t('activeWorkout.addExerciseNotePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={localNote}
              onChangeText={(val) => {
                setLocalNote(val);
              }}
              onFocus={() => setIsEditingNote(true)}
              onBlur={() => {
                setIsEditingNote(false);
                if (updateExerciseNote) {
                  updateExerciseNote(exIdx, localNote.trim() || undefined);
                }
              }}
              multiline
              keyboardAppearance="dark"
              maxLength={150}
              testID={`exercise-notes-input-${exIdx}`}
            />
            {localNote && onSaveLibraryNote && (
              <Pressable
                onPress={() => onSaveLibraryNote(exercise.name, localNote.trim() || undefined)}
                style={({ pressed }) => [{ paddingHorizontal: 6, opacity: pressed ? 0.7 : 1 }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={i18n.t('activeWorkout.saveLibraryNoteA11y')}
              >
                <Ionicons name="bookmark-outline" size={14} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Sets Column Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.columnLabel, styles.colSet]}>SET</Text>
            <Text style={[styles.columnLabel, styles.colWeight, { textAlign: 'center' }]}>KG</Text>
            <Text style={[styles.columnLabel, styles.colReps, { textAlign: 'center' }]}>REPS & RPE</Text>
            <Text style={[styles.columnLabel, styles.colCheck, { textAlign: 'center' }]}>DONE</Text>
          </View>

          {/* Sets Row List */}
          {exercise.sets.slice(0, renderedSetsLimit).map((set: any, setIdx: number) => {
            const isPrevCompleted = setIdx > 0 && exercise.sets[setIdx - 1].completed;
            const isNextCompleted = setIdx < exercise.sets.length - 1 && exercise.sets[setIdx + 1].completed;
            return (
              <ActiveSetRowItem
                key={set.id}
                set={set}
                setIdx={setIdx}
                exIdx={exIdx}
                onFocus={handleSetFocus}
                updateSetField={updateSetField}
                deleteSet={deleteSet}
                toggleSetComplete={toggleSetComplete}
                inputRefs={inputRefs}
                isPrevCompleted={isPrevCompleted}
                isNextCompleted={isNextCompleted}
                isRpeMode={isRpeMode}
              />
            );
          })}

          {/* Add Set Button */}
          <Pressable
            testID={`add-set-btn-${exIdx}`}
            style={({ pressed }) => [
              styles.addSetRow,
              pressed && { transform: [{ scale: 0.96 }] }
            ]}
            onPress={() => addSet(exIdx)}
            onLongPress={() => addSet(exIdx, true)}
            android_ripple={rippleTokens.surface}
            accessibilityLabel="Add set, long press for unilateral set"
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addSetText}>ADD SET</Text>
          </Pressable>
        </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.exIdx === nextProps.exIdx &&
    prevProps.exItemKey === nextProps.exItemKey &&
    prevProps.isSuperSet === nextProps.isSuperSet &&
    prevProps.nextIsSameSuperSet === nextProps.nextIsSameSuperSet &&
    prevProps.prevIsSameSuperSet === nextProps.prevIsSameSuperSet &&
    prevProps.superSetColor === nextProps.superSetColor &&
    prevProps.isRpeMode === nextProps.isRpeMode &&
    prevProps.exercise === nextProps.exercise &&
    prevProps.exerciseLibraryMap === nextProps.exerciseLibraryMap
  );
});
