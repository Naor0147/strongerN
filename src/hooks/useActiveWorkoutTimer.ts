import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { restTimerEmitter } from '../components/layout/restTimerEmitter';
import {
  showWorkoutBackgroundNotification,
  dismissWorkoutBackgroundNotification,
} from '../utils/notifications';
import {
  startWorkoutForeground,
  updateTimerCountdown,
  showTimerComplete,
  stopWorkoutForeground,
} from '../utils/foregroundNotification';
import { formatElapsed } from '../components/layout/activeWorkoutUtils';
import { ActiveExercise } from '../components/layout/activeWorkoutTypes';

export interface UseActiveWorkoutTimerParams {
  visible: boolean;
  localWorkoutName: string;
  activeExercisesRef: React.MutableRefObject<ActiveExercise[]>;
  resumeStartTime: React.MutableRefObject<Date>;
  accumulatedOffsetSeconds: React.MutableRefObject<number>;
  activeInputRef: React.MutableRefObject<any>;
  tempInputValueRef: React.MutableRefObject<string>;
  updateSetField: (exIdx: number, setIdx: number, fieldName: any, value: string) => void;
  flushExercisesToParent: (exs: ActiveExercise[]) => void;
  hasSyncedPropsRef: React.MutableRefObject<boolean>;
}

export function useActiveWorkoutTimer({
  visible,
  localWorkoutName,
  activeExercisesRef,
  resumeStartTime,
  accumulatedOffsetSeconds,
  activeInputRef,
  tempInputValueRef,
  updateSetField,
  flushExercisesToParent,
  hasSyncedPropsRef,
}: UseActiveWorkoutTimerParams) {
  const localWorkoutNameRef = useRef(localWorkoutName);
  useEffect(() => {
    localWorkoutNameRef.current = localWorkoutName;
  }, [localWorkoutName]);

  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    let restTimerUnsubscribe: (() => void) | null = null;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      try {
        if (nextAppState === 'active') {
          if (restTimerUnsubscribe) {
            try {
              restTimerUnsubscribe();
            } catch (e) {}
            restTimerUnsubscribe = null;
          }
          await stopWorkoutForeground().catch((err) => console.warn('[ForegroundNotif] stop error:', err));
          await dismissWorkoutBackgroundNotification().catch((err) => console.warn('[Notif] dismiss error:', err));
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          if (activeInputRef.current) {
            try {
              updateSetField(
                activeInputRef.current.exIdx,
                activeInputRef.current.setIdx,
                activeInputRef.current.fieldName,
                tempInputValueRef.current
              );
            } catch (e) {}
          }
          if (hasSyncedPropsRef.current) {
            try {
              flushExercisesToParent(activeExercisesRef.current);
            } catch (e) {}
          }
          if (visibleRef.current) {
            const workoutNameStr = localWorkoutNameRef.current || 'Workout';
            await startWorkoutForeground(workoutNameStr).catch((err) =>
              console.warn('[ForegroundNotif] start error:', err)
            );

            const initialActive = restTimerEmitter.isActive();
            const initialRemaining = restTimerEmitter.getRemaining();

            const buildWorkoutBody = (timerActive: boolean, timerRemaining: number, timerJustFinished: boolean) => {
              const currentExerciseName =
                activeExercisesRef.current && activeExercisesRef.current.length > 0 && activeExercisesRef.current[0]?.name
                  ? activeExercisesRef.current[0].name
                  : 'Workout in Progress';
              const elapsedStr = formatElapsed(resumeStartTime.current, accumulatedOffsetSeconds.current);
              if (timerJustFinished) {
                return `${currentExerciseName} • ${elapsedStr} • Rest complete — next set ready`;
              }
              return `${currentExerciseName} • ${elapsedStr}${timerActive ? ` • Rest: ${timerRemaining}s` : ''}`;
            };

            const initialBody = buildWorkoutBody(initialActive, initialRemaining, false);
            await showWorkoutBackgroundNotification({
              title: workoutNameStr,
              body: initialBody,
            }).catch(() => {});

            if (restTimerUnsubscribe) {
              try {
                restTimerUnsubscribe();
              } catch (e) {}
            }

            let prevActive = initialActive;
            let prevRemaining = initialRemaining;

            restTimerUnsubscribe = restTimerEmitter.subscribe(async (timerState) => {
              try {
                const activeFlips = timerState.active !== prevActive;
                const remainingHitsZero = timerState.remaining === 0 && prevRemaining > 0;

                if (timerState.active && timerState.remaining > 0) {
                  await updateTimerCountdown(timerState.remaining, workoutNameStr).catch(() => {});
                }

                if (activeFlips || remainingHitsZero) {
                  const timerJustFinished = !timerState.active && prevActive;
                  if (timerJustFinished) {
                    await showTimerComplete(workoutNameStr).catch(() => {});
                  }

                  const body = buildWorkoutBody(timerState.active, timerState.remaining, timerJustFinished);
                  await showWorkoutBackgroundNotification({
                    title: workoutNameStr,
                    body,
                  }).catch(() => {});
                }

                prevActive = timerState.active;
                prevRemaining = timerState.remaining;
              } catch (e) {
                console.warn('[ActiveWorkout] Error in restTimerEmitter background subscriber:', e);
              }
            });
          }
        }
      } catch (e) {
        console.error('[AppState Error in ActiveWorkoutModal]:', e);
      }
    });

    return () => {
      subscription.remove();
      if (restTimerUnsubscribe) {
        try {
          restTimerUnsubscribe();
        } catch (e) {}
      }
      stopWorkoutForeground().catch(() => {});
      dismissWorkoutBackgroundNotification().catch(() => {});
    };
  }, [
    activeExercisesRef,
    activeInputRef,
    accumulatedOffsetSeconds,
    flushExercisesToParent,
    hasSyncedPropsRef,
    resumeStartTime,
    tempInputValueRef,
    updateSetField,
  ]);
}
