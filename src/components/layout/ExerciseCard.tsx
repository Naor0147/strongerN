import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sortable from 'react-native-sortables';
import { colors, spacing, ripple as rippleTokens } from '../../theme';
import { SetRow, SetRowInputField } from './SetRow';
import { exerciseBlockStyles as s } from './exerciseBlockStyles';
import i18n from '../../utils/i18n';

export interface ExerciseCardProps {
  exercise: any;
  exIdx: number;
  activeInput: any;
  onFocus: (exIdx: number, setIdx: number, field: SetRowInputField) => void;
  updateSetField: (exIdx: number, setIdx: number, field: any, value: string) => void;
  deleteSet: (exIdx: number, setIdx: number) => void;
  inputRefs: React.MutableRefObject<{ [key: string]: any }>;
  mode: 'active' | 'editor';
  superSetColor?: string;
  isSuperSet?: boolean;
  nextIsSameSuperSet?: boolean;
  prevIsSameSuperSet?: boolean;
  onMenuPress: (exIdx: number) => void;
  onAddSet: (exIdx: number, isUnilateral?: boolean) => void;
  toggleSetComplete?: (exIdx: number, setIdx: number) => void;
  isRpeMode?: boolean;
  notes?: string;
  dragHandlers?: any;
  tempInputValue?: string;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = React.memo(({
  exercise,
  exIdx,
  activeInput,
  onFocus,
  updateSetField,
  deleteSet,
  inputRefs,
  mode,
  superSetColor,
  isSuperSet,
  nextIsSameSuperSet,
  prevIsSameSuperSet,
  onMenuPress,
  onAddSet,
  toggleSetComplete,
  isRpeMode = true,
  notes,
  dragHandlers,
  tempInputValue,
}) => {
  const isActive = mode === 'active';

  return (
    <View style={[
      s.exerciseCard,
      isSuperSet && superSetColor ? {
        borderLeftWidth: 4,
        borderLeftColor: superSetColor,
      } : undefined,
      nextIsSameSuperSet ? {
        marginBottom: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottomWidth: 0,
      } : undefined,
      prevIsSameSuperSet ? {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      } : undefined,
    ]}>
      {/* Exercise Header */}
      <View style={s.exerciseHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm, flex: 1 }}>
          <Text style={s.exerciseName} numberOfLines={1}>{exercise.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.xs }}>
          <Pressable
            onPress={() => onMenuPress(exIdx)}
            style={s.exEllipsis}
            android_ripple={rippleTokens.borderless}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
          <Sortable.Handle style={s.dragHandle}>
            <Ionicons name="reorder-three" size={22} color={colors.textSecondary} accessibilityLabel="Drag to reorder exercise" />
          </Sortable.Handle>
        </View>
      </View>

      {/* Exercise Notes (active mode only) */}
      {isActive && notes ? (
        <View style={s.notesContainer}>
          <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
          <Text style={s.notesText} numberOfLines={2}>{notes}</Text>
        </View>
      ) : null}

      {/* Table Header */}
      <View style={s.tableHeader}>
        <Text style={[s.columnLabel, s.colSet]}>
          {isActive ? i18n.t('activeWorkout.setLabel') : i18n.t('extras.setColumn')}
        </Text>
        <Text style={[s.columnLabel, s.colWeight, { textAlign: 'center' }]}>
          {isActive ? i18n.t('activeWorkout.kgLabel') : i18n.t('extras.kgColumn')}
        </Text>
        <Text style={[s.columnLabel, s.colReps, { textAlign: 'center' }]}>
          {isActive ? i18n.t('activeWorkout.repsRpe') : i18n.t('extras.repsColumn')}
        </Text>
        {isActive ? (
          <Text style={[s.columnLabel, s.colCheck, { textAlign: 'center' }]}>{i18n.t('activeWorkout.doneBtn')}</Text>
        ) : (
          <View style={s.colCheck} />
        )}
      </View>

      {/* Sets */}
      {exercise.sets.map((set: any, setIdx: number) => {
        const isPrevCompleted = isActive && setIdx > 0 && exercise.sets[setIdx - 1].completed;
        const isNextCompleted = isActive && setIdx < exercise.sets.length - 1 && exercise.sets[setIdx + 1].completed;
        const isActiveRow = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx;
        return (
          <SetRow
            key={set.id}
            set={set}
            setIdx={setIdx}
            exIdx={exIdx}
            activeInput={activeInput}
            onFocus={onFocus}
            updateSetField={updateSetField}
            deleteSet={deleteSet}
            inputRefs={inputRefs}
            mode={mode}
            toggleSetComplete={toggleSetComplete}
            isPrevCompleted={isPrevCompleted}
            isNextCompleted={isNextCompleted}
            isRpeMode={isRpeMode}
            tempInputValue={isActiveRow ? tempInputValue : undefined}
          />
        );
      })}

      {/* Add Set */}
      <Pressable
        style={s.addSetRow}
        onPress={() => onAddSet(exIdx)}
        onLongPress={isActive ? () => onAddSet(exIdx, true) : undefined}
        android_ripple={rippleTokens.surface}
        accessibilityLabel={isActive ? 'Add set, long press for unilateral set' : 'Add set'}
      >
        <Ionicons name="add" size={16} color={colors.accent} />
        <Text style={s.addSetText}>
          {isActive ? i18n.t('activeWorkout.addSet') : i18n.t('extras.addSetBtn')}
        </Text>
      </Pressable>
    </View>
  );
});
