import { useCallback } from 'react';
import { restTimerEmitter } from '../components/layout/restTimerEmitter';

export interface UseRestTimerControllerOptions {
  defaultRestDuration?: number;
}

export function useRestTimerController({ defaultRestDuration = 90 }: UseRestTimerControllerOptions = {}) {
  const startTimer = useCallback((duration?: number) => {
    restTimerEmitter.start(duration ?? defaultRestDuration);
  }, [defaultRestDuration]);

  const stopTimer = useCallback(() => {
    restTimerEmitter.stop();
  }, []);

  const adjustTimer = useCallback((seconds: number) => {
    restTimerEmitter.adjust(seconds);
  }, []);

  return {
    startTimer,
    stopTimer,
    adjustTimer,
    emitter: restTimerEmitter,
  };
}
