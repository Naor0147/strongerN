import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveExercise } from './activeWorkoutTypes';
import { activeInputStore } from '../../utils/activeInputStore';
import { keyboardValueStore } from '../../utils/keyboardValueStore';
import { CustomWorkoutKeyboard } from '../ui/CustomWorkoutKeyboard';

export const ActiveWorkoutKeyboardWrapper = React.memo(({
  activeExercises,
  updateSetField,
  isRpeMode,
  handleNextField,
  handleCloseKeyboard,
  tempInputValueRef,
}: {
  activeExercises: ActiveExercise[];
  updateSetField: any;
  isRpeMode: boolean;
  handleNextField: any;
  handleCloseKeyboard: any;
  tempInputValueRef: React.MutableRefObject<string>;
}) => {
  const [activeInput, setActiveInput] = useState<any>(null);

  useEffect(() => {
    return activeInputStore.subscribe(setActiveInput);
  }, []);

  // Stable onChange: only updates ref + store, never causes wrapper re-render
  const handleChange = useCallback((newValue: string) => {
    tempInputValueRef.current = newValue;
    keyboardValueStore.setValue(newValue);
  }, [tempInputValueRef]);

  // Stable RPE handler via ref to avoid inline recreation
  const activeInputRef = useRef<any>(null);
  activeInputRef.current = activeInput;

  const handleRpeChange = useCallback((newRpe: string) => {
    const ai = activeInputRef.current;
    if (ai) {
      updateSetField(ai.exIdx, ai.setIdx, 'rpe', newRpe);
    }
  }, [updateSetField]);

  if (!activeInput) return null;

  const currentEx = activeExercises[activeInput.exIdx];
  const title = currentEx ? currentEx.name : '';
  const rpeValue = currentEx?.sets[activeInput.setIdx]?.rpe || '';
  const fieldName = activeInput.fieldName;
  const maxLength = fieldName.toLowerCase().includes('reps') ? 4 : 6;
  const inputKey = `${activeInput.exIdx}-${activeInput.setIdx}-${activeInput.fieldName}-${activeInput.focusTime || 0}`;

  return (
    <CustomWorkoutKeyboard
      visible={true}
      inputKey={inputKey}
      value={tempInputValueRef.current}
      onChange={handleChange}
      rpeValue={rpeValue}
      onChangeRpe={handleRpeChange}
      fieldName={fieldName}
      maxLength={maxLength}
      title={title}
      isRpeMode={isRpeMode}
      onNext={handleNextField}
      onClose={handleCloseKeyboard}
    />
  );
});
