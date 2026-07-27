import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SetRecord } from './activeWorkoutTypes';
import { colors, radius } from '../../theme';
import { styles } from './activeWorkoutStyles';
import { useTrackRender } from '../../utils/renderTracker';
import { useExerciseRowGestures } from '../ui/gestureCoexistence';
import { activeInputStore } from '../../utils/activeInputStore';
import { SwipeableRow as SharedSwipeableRow } from './SwipeableRow';
import { SetInputCell } from '../ui/SetInputCell';
import { AnimatedCheckmark } from './AnimatedCheckmark';

export interface ActiveSetRowItemProps {
  set: SetRecord;
  setIdx: number;
  exIdx: number;
  onFocus: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps') => void;
  updateSetField: (exIdx: number, setIdx: number, fieldName: 'weight' | 'reps' | 'rpe' | 'category' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps', value: string) => void;
  deleteSet: (exIdx: number, setIdx: number) => void;
  toggleSetComplete: (exIdx: number, setIdx: number) => void;
  inputRefs: React.MutableRefObject<{ [key: string]: any }>;
  isPrevCompleted: boolean;
  isNextCompleted: boolean;
  isRpeMode?: boolean;
}

export const ActiveSetRowItem: React.FC<ActiveSetRowItemProps> = React.memo(({
  set,
  setIdx,
  exIdx,
  onFocus,
  updateSetField,
  deleteSet,
  toggleSetComplete,
  inputRefs,
  isPrevCompleted,
  isNextCompleted,
  isRpeMode = true,
}) => {
  useTrackRender('ActiveSetRowItem', `${exIdx}-${setIdx}`);
  const { swipeGesture } = useExerciseRowGestures();

  const [activeField, setActiveField] = useState<'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps' | null>(null);

  useEffect(() => {
    return activeInputStore.subscribe((input: any) => {
      const isMyRow = input !== null && input.exIdx === exIdx && input.setIdx === setIdx;
      const field = isMyRow ? input.fieldName : null;
      setActiveField((prev) => {
        if (prev === field) return prev;
        return field;
      });
    });
  }, [exIdx, setIdx]);

  const isWeightFocused = activeField === 'weight';
  const isRepsFocused = activeField === 'reps';
  const isLeftWeightFocused = activeField === 'leftWeight';
  const isLeftRepsFocused = activeField === 'leftReps';
  const isRightWeightFocused = activeField === 'rightWeight';
  const isRightRepsFocused = activeField === 'rightReps';

  const isCompleted = set.completed;
  const showPrevConnected = false;
  const showNextConnected = isCompleted && isNextCompleted;

  const rowStyle = {
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.xs,
    borderBottomLeftRadius: radius.xs,
    borderBottomRightRadius: radius.xs,
  };

  // Unilateral set rendering
  if (set.isUnilateral) {
    return (
      <View style={{ marginBottom: showNextConnected ? 0 : 4 }}>
        <SharedSwipeableRow
          onDelete={() => deleteSet(exIdx, setIdx)}
          borderRadius={radius.xs}
          style={rowStyle}
          blocksExternalGesture={swipeGesture}
          snapBackOnRelease={true}
        >
          <View
            style={[
              styles.setRow,
              styles.unilateralSetRow,
              set.completed && styles.setRowCompleted,
              rowStyle,
            ]}
          >
            {/* Set Number / Category Cycle */}
            <Pressable
              style={[
                styles.colSet,
                styles.setNumCol,
                { justifyContent: 'center', alignItems: 'center' }
              ]}
              onPress={() => {
                if (set.completed) return;
                const categories: ('S' | 'W' | 'D' | 'F')[] = ['S', 'W', 'D', 'F'];
                const currIdx = categories.indexOf(set.category || 'S');
                const nextIdx = (currIdx + 1) % categories.length;
                updateSetField(exIdx, setIdx, 'category', categories[nextIdx]);
              }}
              accessibilityLabel={`Cycle set category for set ${setIdx + 1}`}
            >
              <View
                style={[
                  styles.categoryCircle,
                  set.category === 'W' && styles.categoryWarmup,
                  set.category === 'D' && styles.categoryDrop,
                  set.category === 'F' && styles.categoryFailure,
                  set.completed && styles.categoryCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.setNumText,
                    (set.category && set.category !== 'S') && styles.categoryLabelText,
                    (set.category && set.category !== 'S') && { color: set.category === 'W' ? colors.gold : set.category === 'D' ? colors.highlight : colors.error },
                    set.completed && styles.textCompleted,
                  ]}
                >
                  {set.category && set.category !== 'S' ? set.category : (setIdx + 1)}
                </Text>
              </View>
            </Pressable>

            {/* Left/Right Rows Container */}
            <View style={styles.unilateralContainer}>
              {/* Left Row */}
              <View style={styles.unilateralRow}>
                <Text style={styles.unilateralLabel}>L</Text>
                <View style={styles.unilateralInputWrapper}>
                  <SetInputCell
                    ref={(r: any) => { inputRefs.current[`${exIdx}-${setIdx}-leftWeight`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.inputCompleted,
                      isLeftWeightFocused && { borderColor: colors.accent },
                    ]}
                    textStyle={set.completed && styles.textCompleted}
                    value={String(set.leftWeight || set.weight || '')}
                    onPress={() => onFocus(exIdx, setIdx, 'leftWeight')}
                    placeholder={set.suggestedLeftWeight || set.suggestedWeight || '0'}
                    isActive={isLeftWeightFocused}
                    isCompleted={set.completed}
                    exIdx={exIdx}
                    setIdx={setIdx}
                    fieldName="leftWeight"
                  />
                </View>
                <View style={styles.unilateralInputWrapper}>
                  <SetInputCell
                    ref={(r: any) => { inputRefs.current[`${exIdx}-${setIdx}-leftReps`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.inputCompleted,
                      isLeftRepsFocused && { borderColor: colors.accent },
                    ]}
                    textStyle={set.completed && styles.textCompleted}
                    value={String(set.leftReps || set.reps || '')}
                    onPress={() => onFocus(exIdx, setIdx, 'leftReps')}
                    placeholder={set.suggestedLeftReps || set.suggestedReps || '0'}
                    isActive={isLeftRepsFocused}
                    isCompleted={set.completed}
                    exIdx={exIdx}
                    setIdx={setIdx}
                    fieldName="leftReps"
                  />
                </View>
              </View>

              {/* Right Row */}
              <View style={styles.unilateralRow}>
                <Text style={styles.unilateralLabel}>R</Text>
                <View style={styles.unilateralInputWrapper}>
                  <SetInputCell
                    ref={(r: any) => { inputRefs.current[`${exIdx}-${setIdx}-rightWeight`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.inputCompleted,
                      isRightWeightFocused && { borderColor: colors.accent },
                    ]}
                    textStyle={set.completed && styles.textCompleted}
                    value={String(set.rightWeight || set.weight || '')}
                    onPress={() => onFocus(exIdx, setIdx, 'rightWeight')}
                    placeholder={set.suggestedRightWeight || set.suggestedWeight || '0'}
                    isActive={isRightWeightFocused}
                    isCompleted={set.completed}
                    exIdx={exIdx}
                    setIdx={setIdx}
                    fieldName="rightWeight"
                  />
                </View>
                <View style={styles.unilateralInputWrapper}>
                  <SetInputCell
                    ref={(r: any) => { inputRefs.current[`${exIdx}-${setIdx}-rightReps`] = r; }}
                    style={[
                      styles.unilateralInput,
                      set.completed && styles.inputCompleted,
                      isRightRepsFocused && { borderColor: colors.accent },
                    ]}
                    textStyle={set.completed && styles.textCompleted}
                    value={String(set.rightReps || set.reps || '')}
                    onPress={() => onFocus(exIdx, setIdx, 'rightReps')}
                    placeholder={set.suggestedRightReps || set.suggestedReps || '0'}
                    isActive={isRightRepsFocused}
                    isCompleted={set.completed}
                    exIdx={exIdx}
                    setIdx={setIdx}
                    fieldName="rightReps"
                  />
                </View>
              </View>
            </View>

            {/* Done Button */}
            <Pressable
              style={({ pressed }) => [
                styles.colCheck,
                styles.checkButton,
                pressed && { transform: [{ scale: 0.96 }] }
              ]}
              onPress={() => toggleSetComplete(exIdx, setIdx)}
            >
              <View
                style={[
                  styles.checkCircle,
                  set.completed && styles.checkCircleCompleted,
                ]}
              >
                <AnimatedCheckmark completed={set.completed} />
              </View>
            </Pressable>
          </View>
        </SharedSwipeableRow>
        {showNextConnected && (
          <View style={{ height: 4, backgroundColor: '#111A2E' }} />
        )}
      </View>
    );
  }

  // Standard bilateral set rendering
  return (
    <View style={{ marginBottom: showNextConnected ? 0 : 4 }}>
      <SharedSwipeableRow
        onDelete={() => deleteSet(exIdx, setIdx)}
        borderRadius={radius.xs}
        style={rowStyle}
        blocksExternalGesture={swipeGesture}
        snapBackOnRelease={true}
      >
        <View
          style={[
            styles.setRow,
            set.completed && styles.setRowCompleted,
            rowStyle,
          ]}
        >
          {/* Set Number / Category Cycle */}
          <Pressable
            style={[
              styles.colSet,
              styles.setNumCol,
              { justifyContent: 'center', alignItems: 'center' }
            ]}
            onPress={() => {
              if (set.completed) return;
              const categories: ('S' | 'W' | 'D' | 'F')[] = ['S', 'W', 'D', 'F'];
              const currIdx = categories.indexOf(set.category || 'S');
              const nextIdx = (currIdx + 1) % categories.length;
              updateSetField(exIdx, setIdx, 'category', categories[nextIdx]);
            }}
            accessibilityLabel={`Cycle set category for set ${setIdx + 1}`}
          >
            <View
              style={[
                styles.categoryCircle,
                set.category === 'W' && styles.categoryWarmup,
                set.category === 'D' && styles.categoryDrop,
                set.category === 'F' && styles.categoryFailure,
                set.completed && styles.categoryCompleted,
              ]}
            >
              <Text
                style={[
                  styles.setNumText,
                  (set.category && set.category !== 'S') && styles.categoryLabelText,
                  (set.category && set.category !== 'S') && { color: set.category === 'W' ? colors.gold : set.category === 'D' ? colors.highlight : colors.error },
                  set.completed && styles.textCompleted,
                ]}
              >
                {set.category && set.category !== 'S' ? set.category : (setIdx + 1)}
              </Text>
            </View>
          </Pressable>

          {/* Weight Input */}
          <View style={[styles.colWeight, styles.inputWrapper]}>
            <SetInputCell
              testID={`set-weight-${exIdx}-${setIdx}`}
              ref={(r: any) => { inputRefs.current[`${exIdx}-${setIdx}-weight`] = r; }}
              style={[
                styles.input,
                set.completed && styles.inputCompleted,
                isWeightFocused && { borderColor: colors.accent },
              ]}
              textStyle={set.completed && styles.textCompleted}
              value={String(set.weight || '')}
              onPress={() => onFocus(exIdx, setIdx, 'weight')}
              placeholder={set.suggestedWeight || '0'}
              isActive={isWeightFocused}
              isCompleted={set.completed}
              exIdx={exIdx}
              setIdx={setIdx}
              fieldName="weight"
            />
          </View>

          {/* Reps & RPE Container (Combined UI block) */}
          <View style={[styles.colReps, styles.inputWrapper]}>
            <View
              style={[
                styles.repsRpeContainer,
                set.completed && styles.inputCompleted,
                isRepsFocused && { borderColor: colors.accent },
              ]}
            >
              <SetInputCell
                testID={`set-reps-${exIdx}-${setIdx}`}
                ref={(r: any) => { inputRefs.current[`${exIdx}-${setIdx}-reps`] = r; }}
                style={styles.repsInput}
                textStyle={set.completed && styles.textCompleted}
                value={String(set.reps || '')}
                onPress={() => onFocus(exIdx, setIdx, 'reps')}
                placeholder={set.suggestedReps || '0'}
                isActive={isRepsFocused}
                isCompleted={set.completed}
                exIdx={exIdx}
                setIdx={setIdx}
                fieldName="reps"
              />
              {set.rpe ? (
                <Text style={[styles.rpeInlineText, set.completed && styles.textCompleted]}>
                  {isRpeMode ? `@${set.rpe}` : `${set.rpe}RIR`}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Done Button */}
          <Pressable
            testID={`set-checkbox-${exIdx}-${setIdx}`}
            style={({ pressed }) => [
              styles.colCheck,
              styles.checkButton,
              pressed && { transform: [{ scale: 0.96 }] }
            ]}
            onPress={() => toggleSetComplete(exIdx, setIdx)}
          >
            <View
              style={[
                styles.checkCircle,
                set.completed && styles.checkCircleCompleted,
              ]}
            >
              <AnimatedCheckmark completed={set.completed} />
            </View>
          </Pressable>
        </View>
      </SharedSwipeableRow>
      {showNextConnected && (
        <View style={{ height: 4, backgroundColor: '#111A2E' }} />
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.setIdx === nextProps.setIdx &&
    prevProps.exIdx === nextProps.exIdx &&
    prevProps.isPrevCompleted === nextProps.isPrevCompleted &&
    prevProps.isNextCompleted === nextProps.isNextCompleted &&
    prevProps.isRpeMode === nextProps.isRpeMode &&
    prevProps.set === nextProps.set
  );
});
