import { useState, useCallback } from 'react';
import { restTimerEmitter } from '../components/layout/restTimerEmitter';

export interface UseRestTimerStateParams {
  defaultRestDuration: number;
}

export function useRestTimerState({ defaultRestDuration }: UseRestTimerStateParams) {
  const [isTimerPickerVisible, setIsTimerPickerVisible] = useState(false);
  const [isTimerSubMenuVisible, setIsTimerSubMenuVisible] = useState(false);
  const [autoTimerDraft, setAutoTimerDraft] = useState<number>(defaultRestDuration);

  const startRestTimer = useCallback((seconds: number) => {
    restTimerEmitter.start(seconds);
  }, []);

  const stopRestTimer = useCallback(() => {
    restTimerEmitter.stop();
  }, []);

  const openTimerPicker = useCallback((currentDuration?: number) => {
    setAutoTimerDraft(typeof currentDuration === 'number' ? currentDuration : defaultRestDuration);
    setIsTimerPickerVisible(true);
  }, [defaultRestDuration]);

  const closeTimerPicker = useCallback(() => {
    setIsTimerPickerVisible(false);
  }, []);

  return {
    isTimerPickerVisible,
    setIsTimerPickerVisible,
    isTimerSubMenuVisible,
    setIsTimerSubMenuVisible,
    autoTimerDraft,
    setAutoTimerDraft,
    startRestTimer,
    stopRestTimer,
    openTimerPicker,
    closeTimerPicker,
  };
}
