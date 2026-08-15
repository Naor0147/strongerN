import { useState, useCallback, useRef, useEffect } from 'react';
import { ActiveExercise, SetRecord, SetSuggestion } from '../components/layout/activeWorkoutTypes';
import {
  getBestPerformanceSuggestionForSet,
  getPreviousSessionSetSuggestion,
} from '../components/layout/activeWorkoutUtils';
import { activeInputStore } from '../utils/activeInputStore';
import { keyboardValueStore } from '../utils/keyboardValueStore';
import { restTimerEmitter } from '../components/layout/restTimerEmitter';
import {
  playSetCheckedSound,
  playUncheckSetSound,
  playSatisfyingClickFinishSet,
} from '../utils/soundPlayer';
import { safeLayoutAnim } from '../components/layout/activeWorkoutUtils';
import { saveCrashLogSync } from '../utils/crashLogger';
import { WorkoutSession, Exercise } from '../data/mockData';
import { clearActiveInputPatch } from '../storage/activeInputPatch';
import { ExpectedValuesIndex } from '../storage/expectedValues';
import { activeExerciseStructureReducer } from '../state/activeExerciseReducer';

export interface UseActiveExercisesStateParams {
  initialExercises: ActiveExercise[];
  sessions: WorkoutSession[];
  workoutName: string;
  exerciseLibraryMap: Map<string, Exercise>;
  isProgressiveOverloadEnabled?: boolean;
  isAutoTimerEnabled?: boolean;
  isAutoFinishSetEnabled?: boolean;
  defaultRestDuration: number;
  activeInputRef: React.MutableRefObject<any>;
  tempInputValueRef: React.MutableRefObject<string>;
  activeExercisesRef: React.MutableRefObject<ActiveExercise[]>;
  inputRefs: React.MutableRefObject<{ [key: string]: any }>;
  setIsKeyboardVisible: React.Dispatch<React.SetStateAction<boolean>>;
  activeExerciseMenuIndex: number | null;
  setActiveExerciseMenuIndex: React.Dispatch<React.SetStateAction<number | null>>;
  isReplaceMode: boolean;
  onUpdateExerciseNotes?: (id: string, note?: string) => void;
  sessionsByExerciseMap?: ExpectedValuesIndex;
  onActiveExercisesCommit?: (exercises: ActiveExercise[]) => void;
}

export function useActiveExercisesState({
  initialExercises,
  sessions,
  workoutName,
  exerciseLibraryMap,
  isProgressiveOverloadEnabled = true,
  isAutoTimerEnabled = true,
  isAutoFinishSetEnabled = true,
  defaultRestDuration,
  activeInputRef,
  tempInputValueRef,
  activeExercisesRef,
  inputRefs,
  setIsKeyboardVisible,
  activeExerciseMenuIndex,
  setActiveExerciseMenuIndex,
  isReplaceMode,
  onUpdateExerciseNotes,
  sessionsByExerciseMap,
  onActiveExercisesCommit,
}: UseActiveExercisesStateParams) {
  const [activeExercises, setActiveExercisesState] = useState<ActiveExercise[]>(initialExercises);

  const setActiveExercises = useCallback<React.Dispatch<React.SetStateAction<ActiveExercise[]>>>((action) => {
    const previous = activeExercisesRef.current;
    const next = typeof action === 'function'
      ? (action as (value: ActiveExercise[]) => ActiveExercise[])(previous)
      : action;
    if (next === previous) return;
    onActiveExercisesCommit?.(next);
    activeExercisesRef.current = next;
    setActiveExercisesState(next);
  }, [activeExercisesRef, onActiveExercisesCommit]);

  // Synchronize activeExercisesRef
  useEffect(() => {
    activeExercisesRef.current = activeExercises;
  }, [activeExercises, activeExercisesRef]);

  const recalculateSuggestions = useCallback((exercise: ActiveExercise, exercisePosition: number): ActiveExercise => {
    if (exercise.useRoutineTargets) return exercise;
    const libraryExercise = exerciseLibraryMap.get(exercise.name.toLowerCase());
    const categoryOrdinals: Record<string, number> = {};
    const sets = exercise.sets.map((set) => {
      const category = set.category || 'S';
      const ordinal = categoryOrdinals[category] ?? 0;
      categoryOrdinals[category] = ordinal + 1;
      const unilateral = Boolean(set.isUnilateral ?? libraryExercise?.isUnilateral);
      const suggestion = getBestPerformanceSuggestionForSet(
        exercise.name,
        category,
        ordinal,
        sessions,
        unilateral,
        exercise.variation,
        libraryExercise,
        sessionsByExerciseMap,
        {
          routineName: workoutName,
          exercisePosition,
          supersetGroupId: exercise.superSetGroupId,
          progressiveOverloadEnabled: isProgressiveOverloadEnabled,
          equipment: libraryExercise?.equipment,
        }
      );
      return {
        ...set,
        suggestedWeight: suggestion.weight,
        suggestedReps: suggestion.reps,
        suggestedLeftWeight: unilateral ? suggestion.leftWeight : undefined,
        suggestedLeftReps: unilateral ? suggestion.leftReps : undefined,
        suggestedRightWeight: unilateral ? suggestion.rightWeight : undefined,
        suggestedRightReps: unilateral ? suggestion.rightReps : undefined,
      };
    });
    return { ...exercise, sets };
  }, [exerciseLibraryMap, isProgressiveOverloadEnabled, sessions, sessionsByExerciseMap, workoutName]);

  const reindexActiveExercises = useCallback((exercises: ActiveExercise[]) => (
    activeExerciseStructureReducer(activeExercisesRef.current, { type: 'reorder', exercises }, recalculateSuggestions)
  ), [recalculateSuggestions]);

  // Update a field inside a set
  const updateSetField = useCallback(
    (
      exIdx: number,
      setIdx: number,
      fieldName: keyof SetRecord | 'weight' | 'reps' | 'rpe' | 'category' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps',
      value: string
    ) => {
      setActiveExercises((prev) => {
        if (!prev[exIdx]) return prev;
        const targetEx = prev[exIdx];
        if (!targetEx.sets[setIdx]) return prev;

        const nextSets = [...targetEx.sets];
        const currentSet = { ...nextSets[setIdx] };

        if (fieldName === 'category') {
          currentSet.category = value as 'W' | 'S' | 'D' | 'F';
        } else {
          (currentSet as any)[fieldName] = value;
        }

        nextSets[setIdx] = currentSet;
        const nextArr = [...prev];
        const changedExercise = { ...targetEx, sets: nextSets };
        nextArr[exIdx] = fieldName === 'category'
          ? recalculateSuggestions(changedExercise, exIdx)
          : changedExercise;
        return nextArr;
      });
      clearActiveInputPatch();
    },
    [recalculateSuggestions]
  );

  // Toggle set completion
  const toggleSetComplete = useCallback(
    (exIdx: number, setIdx: number) => {
      const currentEx = activeExercisesRef.current[exIdx];
      const target = currentEx?.sets[setIdx];
      if (!target) return;

      const willBeCompleted = !target.completed;
      if (willBeCompleted) {
        playSetCheckedSound();
        playSatisfyingClickFinishSet();
        if (isAutoTimerEnabled) {
          const customRest = currentEx.autoTimer;
          const duration = typeof customRest === 'number' ? customRest : defaultRestDuration;
          restTimerEmitter.start(duration);
        }
      } else {
        playUncheckSetSound();
      }

      safeLayoutAnim();
      setActiveExercises((prev) => {
        if (!prev[exIdx]) return prev;
        const targetEx = prev[exIdx];
        if (!targetEx.sets[setIdx]) return prev;
        const targetSet = targetEx.sets[setIdx];

        let updatedSet = { ...targetSet, completed: willBeCompleted };
        if (
          activeInputRef.current &&
          activeInputRef.current.exIdx === exIdx &&
          activeInputRef.current.setIdx === setIdx
        ) {
          const fName = activeInputRef.current.fieldName as keyof SetRecord;
          if (tempInputValueRef.current !== undefined) {
            (updatedSet as any)[fName] = tempInputValueRef.current;
          }
        }

        const nextSets = [...targetEx.sets];
        nextSets[setIdx] = updatedSet;
        const nextArr = [...prev];
        nextArr[exIdx] = { ...targetEx, sets: nextSets };
        return nextArr;
      });
      clearActiveInputPatch();
    },
    [isAutoTimerEnabled, defaultRestDuration, activeExercisesRef, activeInputRef, tempInputValueRef]
  );

  // Add a set
  const addSet = useCallback(
    (exIdx: number, isUnilateral?: boolean) => {
      safeLayoutAnim();
      setActiveExercises((prev) => {
        if (!prev[exIdx]) return prev;
        const targetEx = prev[exIdx];
        const currentSets = targetEx.sets;
        const lastSet = currentSets[currentSets.length - 1];
        const category = lastSet?.category ?? 'S';
        const positionInCategory = currentSets.filter((s) => (s.category || 'S') === category).length;
        const unilateral = isUnilateral !== undefined ? isUnilateral : lastSet ? !!lastSet.isUnilateral : false;

        const histSuggested = targetEx.useRoutineTargets
          ? { weight: '', reps: '', leftWeight: '', leftReps: '', rightWeight: '', rightReps: '' }
          : getPreviousSessionSetSuggestion(
              targetEx.name,
              category,
              positionInCategory,
              sessions,
              unilateral,
              workoutName,
              exIdx,
              sessionsByExerciseMap,
              {
                routineName: workoutName,
                exercisePosition: exIdx,
                supersetGroupId: targetEx.superSetGroupId,
                progressiveOverloadEnabled: isProgressiveOverloadEnabled,
                equipment: exerciseLibraryMap.get(targetEx.name.toLowerCase())?.equipment,
              }
            );
        let suggested: SetSuggestion = {
          weight: '',
          reps: '',
          leftWeight: '',
          leftReps: '',
          rightWeight: '',
          rightReps: '',
        };

        if (histSuggested.weight || histSuggested.reps || histSuggested.leftWeight) {
          suggested = histSuggested;
        } else if (lastSet) {
          const fallbackW = lastSet.weight || (lastSet as any).suggestedWeight || '';
          const fallbackR = lastSet.reps || (lastSet as any).suggestedReps || '';
          suggested = {
            weight: fallbackW,
            reps: fallbackR,
            leftWeight: lastSet.leftWeight || (lastSet as any).suggestedLeftWeight || fallbackW,
            leftReps: lastSet.leftReps || (lastSet as any).suggestedLeftReps || fallbackR,
            rightWeight: lastSet.rightWeight || (lastSet as any).suggestedRightWeight || fallbackW,
            rightReps: lastSet.rightReps || (lastSet as any).suggestedRightReps || fallbackR,
          };
        }

        const newSet: SetRecord = {
          id: `set-${exIdx}-${Date.now()}-${Math.random()}`,
          weight: '',
          reps: '',
          completed: false,
          rpe: '',
          category: category,
          isUnilateral: unilateral,
          leftWeight: unilateral ? '' : undefined,
          leftReps: unilateral ? '' : undefined,
          rightWeight: unilateral ? '' : undefined,
          rightReps: unilateral ? '' : undefined,
          suggestedWeight: suggested.weight,
          suggestedReps: suggested.reps,
          suggestedLeftWeight: unilateral ? suggested.leftWeight : undefined,
          suggestedLeftReps: unilateral ? suggested.leftReps : undefined,
          suggestedRightWeight: unilateral ? suggested.rightWeight : undefined,
          suggestedRightReps: unilateral ? suggested.rightReps : undefined,
        } as any;

        const nextArr = [...prev];
        nextArr[exIdx] = {
          ...targetEx,
          sets: [...currentSets, newSet],
        };
        return nextArr;
      });
    },
    [exerciseLibraryMap, isProgressiveOverloadEnabled, sessions, sessionsByExerciseMap, workoutName]
  );

  // Delete a set
  const deleteSet = useCallback(
    (exIdx: number, setIdx: number) => {
      try {
        setActiveExercises((prev) => {
          if (!prev[exIdx]) return prev;
          return activeExerciseStructureReducer(
            prev,
            { type: 'delete-set', exerciseIndex: exIdx, setIndex: setIdx },
            recalculateSuggestions,
          );
        });

        const curr = activeInputRef.current;
        if (curr && curr.exIdx === exIdx) {
          if (curr.setIdx === setIdx) {
            activeInputRef.current = null;
            activeInputStore.setActiveInput(null);
            setIsKeyboardVisible(false);
          } else if (curr.setIdx > setIdx) {
            const nextVal = { ...curr, setIdx: curr.setIdx - 1 };
            activeInputRef.current = nextVal;
            activeInputStore.setActiveInput(nextVal);
          }
        }
      } catch (err: any) {
        const msg = `[ActiveWorkout] deleteSet(exIdx=${exIdx}, setIdx=${setIdx}) crashed: ${err?.message ?? err}`;
        saveCrashLogSync(msg, err?.stack ?? '', false);
        console.error(msg, err);
      }
    },
    [activeInputRef, recalculateSuggestions, setIsKeyboardVisible]
  );

  // Delete an exercise
  const handleDeleteExercise = useCallback(
    (exIdx: number) => {
      setActiveExercises((prev) => {
        return activeExerciseStructureReducer(
          prev,
          { type: 'delete-exercise', exerciseIndex: exIdx },
          recalculateSuggestions,
        );
      });

      const curr = activeInputRef.current;
      if (curr) {
        if (curr.exIdx === exIdx) {
          activeInputRef.current = null;
          activeInputStore.setActiveInput(null);
          setIsKeyboardVisible(false);
        } else if (curr.exIdx > exIdx) {
          const nextVal = { ...curr, exIdx: curr.exIdx - 1 };
          activeInputRef.current = nextVal;
          activeInputStore.setActiveInput(nextVal);
        }
      }
    },
    [activeInputRef, recalculateSuggestions, setIsKeyboardVisible]
  );

  // Update exercise note
  const updateExerciseNote = useCallback((exIdx: number, note?: string, isNoteLocked?: boolean) => {
    setActiveExercises((prev) => {
      const next = [...prev];
      if (next[exIdx]) {
        const currentEx = next[exIdx];
        next[exIdx] = {
          ...currentEx,
          note,
          showNote: currentEx.showNote !== false ? true : false,
          isNoteLocked: isNoteLocked !== undefined ? isNoteLocked : currentEx.isNoteLocked,
        };
      }
      return next;
    });
  }, []);

  // Save library note
  const onSaveLibraryNote = useCallback(
    (exerciseName: string, note?: string) => {
      const libEx = exerciseLibraryMap.get(exerciseName.toLowerCase());
      if (libEx && onUpdateExerciseNotes) {
        onUpdateExerciseNotes(libEx.id, note);
      }
    },
    [exerciseLibraryMap, onUpdateExerciseNotes]
  );

  // Select variation
  const handleSelectVariation = useCallback(
    (exIdx: number, newVariation: string | undefined) => {
      setActiveExercises((prev: ActiveExercise[]) => {
        if (!prev[exIdx] || !prev[exIdx].name || typeof prev[exIdx].name !== 'string') return prev;
        const targetEx = prev[exIdx];
        const libEx = exerciseLibraryMap.get(targetEx.name.toLowerCase());
        const isUnilateral = libEx?.isUnilateral || false;

        const updatedSets = targetEx.sets.map((s, sIdx) => {
          const category = s.category || 'S';
          let positionInCategory = 0;
          for (let i = 0; i < sIdx; i++) {
            if ((targetEx.sets[i].category || 'S') === category) {
              positionInCategory++;
            }
          }

          const defaultW = '';
          const defaultR = '';
          let suggested: SetSuggestion = {
            weight: defaultW,
            reps: defaultR,
            leftWeight: defaultW,
            leftReps: defaultR,
            rightWeight: defaultW,
            rightReps: defaultR,
          };

          if (sessions && sessions.length > 0) {
            try {
              const perfSuggested = getBestPerformanceSuggestionForSet(
                targetEx.name,
                category,
                positionInCategory,
                sessions,
                isUnilateral,
                newVariation,
                libEx,
                sessionsByExerciseMap,
                {
                  routineName: workoutName,
                  exercisePosition: exIdx,
                  supersetGroupId: targetEx.superSetGroupId,
                  progressiveOverloadEnabled: isProgressiveOverloadEnabled,
                  equipment: libEx?.equipment,
                }
              );
              if (perfSuggested.weight || perfSuggested.reps) {
                suggested = perfSuggested;
              }
            } catch (err) {
              console.warn('[ActiveWorkout] Error getting performance suggestion for variation:', err);
            }
          }

          return {
            ...s,
            suggestedWeight: suggested.weight,
            suggestedReps: suggested.reps,
            suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
            suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
            suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
            suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
          };
        });

        const nextArr = [...prev];
        nextArr[exIdx] = {
          ...targetEx,
          variation: newVariation,
          sets: updatedSets,
        };
        return nextArr;
      });
    },
    [exerciseLibraryMap, isProgressiveOverloadEnabled, sessions, sessionsByExerciseMap, workoutName]
  );

  // Confirm exercises from picker (Add or Replace)
  const handleConfirmExercisesFromPicker = useCallback(
    (names: string[]) => {
      if (isReplaceMode && activeExerciseMenuIndex !== null && names.length > 0) {
        const exName = names[0];
        const targetEx = activeExercises[activeExerciseMenuIndex];
        const replacementLibraryExercise = exerciseLibraryMap.get(exName.toLowerCase());
        const isUnilateral = replacementLibraryExercise?.isUnilateral || false;

        const updatedSets = targetEx.sets.map((s, sIdx) => {
          const category = s.category || 'S';
          let positionInCategory = 0;
          for (let i = 0; i < sIdx; i++) {
            if ((targetEx.sets[i].category || 'S') === category) {
              positionInCategory++;
            }
          }
          const libEx = exerciseLibraryMap.get(exName.toLowerCase());
          const defaultW = '';
          const defaultR = '';
          let suggested: SetSuggestion = {
            weight: defaultW,
            reps: defaultR,
            leftWeight: defaultW,
            leftReps: defaultR,
            rightWeight: defaultW,
            rightReps: defaultR,
          };
          if (sessions && sessions.length > 0) {
            const perfSuggested = getBestPerformanceSuggestionForSet(
              exName,
              category,
              positionInCategory,
              sessions,
              isUnilateral,
              undefined,
              replacementLibraryExercise,
              sessionsByExerciseMap,
              {
                routineName: workoutName,
                exercisePosition: activeExerciseMenuIndex,
                supersetGroupId: targetEx.superSetGroupId,
                progressiveOverloadEnabled: isProgressiveOverloadEnabled,
                equipment: replacementLibraryExercise?.equipment,
              }
            );
            if (perfSuggested.weight || perfSuggested.reps) {
              suggested = perfSuggested;
            }
          }
          return {
            id: `set-${activeExerciseMenuIndex}-${sIdx}-${Date.now()}`,
            weight: '',
            reps: '',
            completed: false,
            rpe: '',
            category: (s.category || 'S') as 'W' | 'S' | 'D' | 'F',
            isUnilateral: isUnilateral,
            leftWeight: isUnilateral ? '' : undefined,
            leftReps: isUnilateral ? '' : undefined,
            rightWeight: isUnilateral ? '' : undefined,
            rightReps: isUnilateral ? '' : undefined,
            suggestedWeight: suggested.weight,
            suggestedReps: suggested.reps,
            suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
            suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
            suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
            suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
          };
        });

        setActiveExercises((prev) =>
          prev.map((ex, idx) => {
            if (idx === activeExerciseMenuIndex) {
              return {
                id: ex.id,
                name: exName,
                sets: updatedSets,
                superSetGroupId: ex.superSetGroupId,
              };
            }
            return ex;
          })
        );
        setActiveExerciseMenuIndex(null);
      } else {
        const newOnes: ActiveExercise[] = names.map((exName, idx) => {
          const libEx = exerciseLibraryMap.get(exName.toLowerCase());
          const isUnilateral = libEx?.isUnilateral || false;

          let setsCount = 3;
          if (sessions && sessions.length > 0) {
            const previousSession = sessions.find(
              (s: any) =>
                s.exercises && s.exercises.some((e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase())
            );
            const found = previousSession?.exercises.find(
              (e: any) => e.name && e.name.toLowerCase() === exName.toLowerCase()
            );
            if (found) {
              setsCount = found.setsDetails?.length || found.sets || 3;
            }
          }

          const sets = Array.from({ length: setsCount }).map((_, sIdx) => {
            const category = 'S';
            const positionInCategory = sIdx;
            const defaultW = '';
            const defaultR = '';
            let suggested: SetSuggestion = {
              weight: defaultW,
              reps: defaultR,
              leftWeight: defaultW,
              leftReps: defaultR,
              rightWeight: defaultW,
              rightReps: defaultR,
            };
            if (sessions && sessions.length > 0) {
              const perfSuggested = getBestPerformanceSuggestionForSet(
                exName,
                category,
                positionInCategory,
                sessions,
                isUnilateral,
                undefined,
                libEx,
                sessionsByExerciseMap,
                {
                  routineName: workoutName,
                  exercisePosition: activeExercises.length + idx,
                  progressiveOverloadEnabled: isProgressiveOverloadEnabled,
                  equipment: libEx?.equipment,
                }
              );
              if (perfSuggested.weight || perfSuggested.reps) {
                suggested = perfSuggested;
              }
            }
            return {
              id: `set-${Date.now()}-${idx}-${sIdx}`,
              weight: '',
              reps: '',
              completed: false,
              rpe: '',
              category: 'S' as const,
              isUnilateral: isUnilateral,
              leftWeight: isUnilateral ? '' : undefined,
              leftReps: isUnilateral ? '' : undefined,
              rightWeight: isUnilateral ? '' : undefined,
              rightReps: isUnilateral ? '' : undefined,
              suggestedWeight: suggested.weight,
              suggestedReps: suggested.reps,
              suggestedLeftWeight: isUnilateral ? suggested.leftWeight : undefined,
              suggestedLeftReps: isUnilateral ? suggested.leftReps : undefined,
              suggestedRightWeight: isUnilateral ? suggested.rightWeight : undefined,
              suggestedRightReps: isUnilateral ? suggested.rightReps : undefined,
            };
          });

          return {
            id: `ex-${Date.now()}-${idx}`,
            name: exName,
            sets: sets,
          };
        });

        setActiveExercises((prev) => [...prev, ...newOnes]);
      }
    },
    [
      isReplaceMode,
      activeExerciseMenuIndex,
      activeExercises,
      exerciseLibraryMap,
      isProgressiveOverloadEnabled,
      sessions,
      sessionsByExerciseMap,
      workoutName,
      setActiveExerciseMenuIndex,
    ]
  );

  return {
    activeExercises,
    setActiveExercises,
    updateSetField,
    toggleSetComplete,
    addSet,
    deleteSet,
    handleDeleteExercise,
    updateExerciseNote,
    onSaveLibraryNote,
    handleSelectVariation,
    handleConfirmExercisesFromPicker,
    reindexActiveExercises,
  };
}
