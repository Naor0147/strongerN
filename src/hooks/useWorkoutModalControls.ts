import { useState, useCallback } from 'react';

export interface UseWorkoutModalControlsParams {
  defaultRestDuration: number;
}

export function useWorkoutModalControls({ defaultRestDuration }: UseWorkoutModalControlsParams) {
  const [isWorkoutMenuVisible, setIsWorkoutMenuVisible] = useState(false);
  const [isStartTimePickerVisible, setIsStartTimePickerVisible] = useState(false);
  const [editedStartTimeText, setEditedStartTimeText] = useState('');
  const [isDefaultTimerPickerVisible, setIsDefaultTimerPickerVisible] = useState(false);
  const [localDefaultRest, setLocalDefaultRest] = useState<number>(defaultRestDuration);
  const [customDefaultTimerValue, setCustomDefaultTimerValue] = useState('');

  const openWorkoutMenu = useCallback(() => {
    setIsWorkoutMenuVisible(true);
  }, []);

  const closeWorkoutMenu = useCallback(() => {
    setIsWorkoutMenuVisible(false);
  }, []);

  const openStartTimePicker = useCallback((initialText?: string) => {
    if (initialText !== undefined) {
      setEditedStartTimeText(initialText);
    }
    setIsStartTimePickerVisible(true);
  }, []);

  const closeStartTimePicker = useCallback(() => {
    setIsStartTimePickerVisible(false);
  }, []);

  const openDefaultTimerPicker = useCallback(() => {
    setIsDefaultTimerPickerVisible(true);
  }, []);

  const closeDefaultTimerPicker = useCallback(() => {
    setIsDefaultTimerPickerVisible(false);
  }, []);

  return {
    isWorkoutMenuVisible,
    setIsWorkoutMenuVisible,
    isStartTimePickerVisible,
    setIsStartTimePickerVisible,
    editedStartTimeText,
    setEditedStartTimeText,
    isDefaultTimerPickerVisible,
    setIsDefaultTimerPickerVisible,
    localDefaultRest,
    setLocalDefaultRest,
    customDefaultTimerValue,
    setCustomDefaultTimerValue,
    openWorkoutMenu,
    closeWorkoutMenu,
    openStartTimePicker,
    closeStartTimePicker,
    openDefaultTimerPicker,
    closeDefaultTimerPicker,
  };
}
