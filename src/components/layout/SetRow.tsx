import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme';
import { SwipeableRow } from './SwipeableRow';
import { exerciseBlockStyles as s } from './exerciseBlockStyles';
import { useExerciseRowGestures } from '../ui/gestureCoexistence';

export interface SetRowActiveInput {
  exIdx: number;
  setIdx: number;
  fieldName: string;
}

export type SetRowInputField = 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
export type SetRowAnyField = 'weight' | 'reps' | 'rpe' | 'category' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';

export interface SetRowProps {
  set: any;
  setIdx: number;
  exIdx: number;
  activeInput: SetRowActiveInput | null;
  onFocus: (exIdx: number, setIdx: number, field: SetRowInputField) => void;
  updateSetField: (exIdx: number, setIdx: number, field: SetRowAnyField, value: string) => void;
  deleteSet: (exIdx: number, setIdx: number) => void;
  inputRefs: React.MutableRefObject<{ [key: string]: any }>;
  mode: 'active' | 'editor';
  toggleSetComplete?: (exIdx: number, setIdx: number) => void;
  isPrevCompleted?: boolean;
  isNextCompleted?: boolean;
  isRpeMode?: boolean;
  tempInputValue?: string;
}

export const SetRow: React.FC<SetRowProps> = React.memo(({
  set,
  setIdx,
  exIdx,
  activeInput,
  onFocus,
  updateSetField,
  deleteSet,
  inputRefs,
  mode,
  toggleSetComplete,
  isPrevCompleted = false,
  isNextCompleted = false,
  isRpeMode = true,
  tempInputValue,
}) => {
  const isActive = mode === 'active';
  const isCompleted = isActive && set.completed;
  const showPrevConnected = isCompleted && isPrevCompleted;
  const showNextConnected = isCompleted && isNextCompleted;
  const { swipeGesture } = useExerciseRowGestures();

  const rowStyle = isActive ? {
    borderTopLeftRadius: showPrevConnected ? 0 : radius.xs,
    borderTopRightRadius: showPrevConnected ? 0 : radius.xs,
    borderBottomLeftRadius: showNextConnected ? 0 : radius.xs,
    borderBottomRightRadius: showNextConnected ? 0 : radius.xs,
  } : undefined;

  const isWeightFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'weight';
  const isRepsFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'reps';
  const isLeftWeightFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'leftWeight';
  const isLeftRepsFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'leftReps';
  const isRightWeightFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'rightWeight';
  const isRightRepsFocused = activeInput?.exIdx === exIdx && activeInput?.setIdx === setIdx && activeInput?.fieldName === 'rightReps';

  // Unilateral set
  if (set.isUnilateral) {
    return (
      <SwipeableRow
        onDelete={() => deleteSet(exIdx, setIdx)}
        borderRadius={radius.xs}
        style={{
          marginBottom: isActive ? (showNextConnected ? 0 : 4) : 4,
          ...rowStyle,
        }}
        blocksExternalGesture={swipeGesture}
      >
        <View
          style={[
            s.setRow,
            s.unilateralSetRow,
            isCompleted && s.setRowCompleted,
            rowStyle,
          ]}
        >
          {/* Set Number / Category */}
          {isActive ? (
            <Pressable
              style={[s.colSet, s.setNumCol, { justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => {
                if (set.completed) return;
                const categories: ('S' | 'W' | 'D' | 'F')[] = ['S', 'W', 'D', 'F'];
                const currIdx = categories.indexOf(set.category || 'S');
                const nextIdx = (currIdx + 1) % categories.length;
                updateSetField(exIdx, setIdx, 'category', categories[nextIdx]);
              }}
              unstable_pressDelay={0}
            >
              <View
                style={[
                  s.categoryCircle,
                  set.category === 'W' && s.categoryWarmup,
                  set.category === 'D' && s.categoryDrop,
                  set.category === 'F' && s.categoryFailure,
                  set.completed && s.categoryCompleted,
                ]}
              >
                <Text
                  style={[
                    s.setNumText,
                    (set.category && set.category !== 'S') && s.categoryLabelText,
                    (set.category && set.category !== 'S') && { color: set.category === 'W' ? colors.gold : set.category === 'D' ? colors.highlight : colors.error },
                    set.completed && s.textCompleted,
                  ]}
                >
                  {set.category && set.category !== 'S' ? set.category : (setIdx + 1)}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={[s.colSet, s.setNumCol]}>
              <Text style={s.setNumText}>{setIdx + 1}</Text>
            </View>
          )}

          {/* Left/Right Container */}
          <View style={s.unilateralContainer}>
            {/* Left Row */}
            <View style={s.unilateralRow}>
              <Text style={s.unilateralLabel}>L</Text>
              <View style={s.unilateralInputWrapper}>
                <TextInput
                  ref={r => { inputRefs.current[`${exIdx}-${setIdx}-leftWeight`] = r; }}
                  style={[
                    s.unilateralInput,
                    isCompleted && s.inputCompleted,
                    isCompleted && s.textCompleted,
                    isLeftWeightFocused && { borderColor: colors.accent, borderWidth: 1 },
                  ]}
                  showSoftInputOnFocus={false}
                  keyboardType="numeric"
                  value={isLeftWeightFocused ? (tempInputValue ?? '') : String(set.leftWeight ?? '')}
                  onFocus={() => onFocus(exIdx, setIdx, 'leftWeight')}
                  placeholder={String(set.suggestedLeftWeight ?? set.suggestedWeight ?? '0')}
                  placeholderTextColor={colors.textMuted}
                  editable={!isCompleted}
                  selectTextOnFocus
                />
              </View>
              <View style={s.unilateralInputWrapper}>
                <TextInput
                  ref={r => { inputRefs.current[`${exIdx}-${setIdx}-leftReps`] = r; }}
                  style={[
                    s.unilateralInput,
                    isCompleted && s.textCompleted,
                    isLeftRepsFocused && { borderColor: colors.accent, borderWidth: 1 },
                  ]}
                  showSoftInputOnFocus={false}
                  keyboardType="numeric"
                  value={isLeftRepsFocused ? (tempInputValue ?? '') : String(set.leftReps ?? '')}
                  onFocus={() => onFocus(exIdx, setIdx, 'leftReps')}
                  placeholder={String(set.suggestedLeftReps ?? set.suggestedReps ?? '0')}
                  placeholderTextColor={colors.textMuted}
                  editable={!isCompleted}
                  selectTextOnFocus
                />
              </View>
            </View>

            {/* Right Row */}
            <View style={s.unilateralRow}>
              <Text style={s.unilateralLabel}>R</Text>
              <View style={s.unilateralInputWrapper}>
                <TextInput
                  ref={r => { inputRefs.current[`${exIdx}-${setIdx}-rightWeight`] = r; }}
                  style={[
                    s.unilateralInput,
                    isCompleted && s.inputCompleted,
                    isCompleted && s.textCompleted,
                    isRightWeightFocused && { borderColor: colors.accent, borderWidth: 1 },
                  ]}
                  showSoftInputOnFocus={false}
                  keyboardType="numeric"
                  value={isRightWeightFocused ? (tempInputValue ?? '') : String(set.rightWeight ?? '')}
                  onFocus={() => onFocus(exIdx, setIdx, 'rightWeight')}
                  placeholder={String(set.suggestedRightWeight ?? set.suggestedWeight ?? '0')}
                  placeholderTextColor={colors.textMuted}
                  editable={!isCompleted}
                  selectTextOnFocus
                />
              </View>
              <View style={s.unilateralInputWrapper}>
                <TextInput
                  ref={r => { inputRefs.current[`${exIdx}-${setIdx}-rightReps`] = r; }}
                  style={[
                    s.unilateralInput,
                    isCompleted && s.textCompleted,
                    isRightRepsFocused && { borderColor: colors.accent, borderWidth: 1 },
                  ]}
                  showSoftInputOnFocus={false}
                  keyboardType="numeric"
                  value={isRightRepsFocused ? (tempInputValue ?? '') : String(set.rightReps ?? '')}
                  onFocus={() => onFocus(exIdx, setIdx, 'rightReps')}
                  placeholder={String(set.suggestedRightReps ?? set.suggestedReps ?? '0')}
                  placeholderTextColor={colors.textMuted}
                  editable={!isCompleted}
                  selectTextOnFocus
                />
              </View>
            </View>
          </View>

          {/* Done (active mode only — sets are deleted by swiping left) */}
          {isActive && toggleSetComplete ? (
            <Pressable
              style={[s.colCheck, s.checkButton]}
              onPress={() => toggleSetComplete(exIdx, setIdx)}
              unstable_pressDelay={0}
            >
              <View style={[s.checkCircle, set.completed && s.checkCircleCompleted]}>
                {set.completed && <Ionicons name="checkmark" size={14} color="#0D0F14" />}
              </View>
            </Pressable>
          ) : (
            <View style={[s.colCheck, s.checkButton, { opacity: 0.2 }]}>
              <View style={s.checkCircle} />
            </View>
          )}
        </View>
      </SwipeableRow>
    );
  }

  // Bilateral set
  return (
    <SwipeableRow
      onDelete={() => deleteSet(exIdx, setIdx)}
      borderRadius={radius.xs}
      style={{
        marginBottom: isActive ? (showNextConnected ? 0 : 4) : 4,
        ...rowStyle,
      }}
      blocksExternalGesture={swipeGesture}
    >
      <View
        style={[
          s.setRow,
          isCompleted && s.setRowCompleted,
          rowStyle,
        ]}
      >
        {/* Set Number / Category */}
        {isActive ? (
          <Pressable
            style={[s.colSet, s.setNumCol, { justifyContent: 'center', alignItems: 'center' }]}
            onPress={() => {
              if (set.completed) return;
              const categories: ('S' | 'W' | 'D' | 'F')[] = ['S', 'W', 'D', 'F'];
              const currIdx = categories.indexOf(set.category || 'S');
              const nextIdx = (currIdx + 1) % categories.length;
              updateSetField(exIdx, setIdx, 'category', categories[nextIdx]);
            }}
unstable_pressDelay={0}
          >
            <View
              style={[
                s.categoryCircle,
                set.category === 'W' && s.categoryWarmup,
                set.category === 'D' && s.categoryDrop,
                set.category === 'F' && s.categoryFailure,
                set.completed && s.categoryCompleted,
              ]}
            >
              <Text
                style={[
                  s.setNumText,
                  (set.category && set.category !== 'S') && s.categoryLabelText,
                  (set.category && set.category !== 'S') && { color: set.category === 'W' ? colors.gold : set.category === 'D' ? colors.highlight : colors.error },
                  set.completed && s.textCompleted,
                ]}
              >
                {set.category && set.category !== 'S' ? set.category : (setIdx + 1)}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View style={[s.colSet, s.setNumCol]}>
            <Text style={s.setNumText}>{setIdx + 1}</Text>
          </View>
        )}

        {/* Weight Input */}
        <View style={[s.colWeight, s.inputWrapper]}>
          <TextInput
            ref={r => { inputRefs.current[`${exIdx}-${setIdx}-weight`] = r; }}
            style={[
              s.input,
              isCompleted && s.inputCompleted,
              isCompleted && s.textCompleted,
              isWeightFocused && { borderColor: colors.accent },
            ]}
            showSoftInputOnFocus={false}
            keyboardType="numeric"
            value={isWeightFocused ? (tempInputValue ?? '') : String(set.weight || '')}
            onFocus={() => onFocus(exIdx, setIdx, 'weight')}
            placeholder={String(set.suggestedWeight || '0')}
            placeholderTextColor={colors.textMuted}
            editable={!isCompleted}
            selectTextOnFocus
          />
        </View>

        {/* Reps (+ RPE in active mode) */}
        {isActive ? (
          <View style={[s.colReps, s.inputWrapper]}>
            <View
              style={[
                s.repsRpeContainer,
                isCompleted && s.inputCompleted,
                isRepsFocused && { borderColor: colors.accent },
              ]}
            >
              <TextInput
                ref={r => { inputRefs.current[`${exIdx}-${setIdx}-reps`] = r; }}
                style={[s.repsInput, isCompleted && s.textCompleted]}
                showSoftInputOnFocus={false}
                value={isRepsFocused ? (tempInputValue ?? '') : String(set.reps || '')}
                onFocus={() => onFocus(exIdx, setIdx, 'reps')}
                placeholder={String(set.suggestedReps || '0')}
                placeholderTextColor={colors.textMuted}
                editable={!isCompleted}
                selectTextOnFocus
              />
              {set.rpe ? (
                <Text style={[s.rpeInlineText, isCompleted && s.textCompleted]}>
                  {isRpeMode ? `@${set.rpe}` : `${set.rpe}RIR`}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={[s.colReps, s.inputWrapper]}>
            <TextInput
              ref={r => { inputRefs.current[`${exIdx}-${setIdx}-reps`] = r; }}
              style={[
                s.input,
                isRepsFocused && { borderColor: colors.accent },
              ]}
              showSoftInputOnFocus={false}
              keyboardType="numeric"
              value={isRepsFocused ? (tempInputValue ?? '') : String(set.reps || '')}
              onFocus={() => onFocus(exIdx, setIdx, 'reps')}
              placeholder={String(set.suggestedReps || '0')}
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />
          </View>
        )}

        {/* Done (active mode only — sets are deleted by swiping left) */}
        {isActive && toggleSetComplete ? (
          <Pressable
            style={[s.colCheck, s.checkButton]}
            onPress={() => toggleSetComplete(exIdx, setIdx)}
            unstable_pressDelay={0}
          >
            <View style={[s.checkCircle, set.completed && s.checkCircleCompleted]}>
              {set.completed && <Ionicons name="checkmark" size={14} color="#0D0F14" />}
            </View>
          </Pressable>
        ) : (
          <View style={[s.colCheck, s.checkButton, { opacity: 0.2 }]}>
            <View style={s.checkCircle} />
          </View>
        )}
      </View>
    </SwipeableRow>
  );
});
