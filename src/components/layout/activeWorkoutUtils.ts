import { Platform, Alert, LayoutAnimation, UIManager } from 'react-native';
import { ActiveExercise, SetSuggestion } from './activeWorkoutTypes';
import { getSessionsForExerciseVariation } from '../../utils/variationUtils';
import { ExpectedValueContext, ExpectedValuesIndex, resolveLastPerformanceSuggestion } from '../../storage/expectedValues';

export const safeLayoutAnim = (preset = LayoutAnimation.Presets.easeInEaseOut) => {
  try {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      LayoutAnimation.configureNext(preset);
    }
  } catch { /* no-op — Fabric doesn't support LayoutAnimation reliably */ }
};

export const WebSafeAlert = {
  alert: (title: string, message?: string, buttons?: { text: string; onPress?: () => void; style?: string }[]) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 1) {
        const confirmResult = window.confirm(`${title}\n\n${message || ''}`);
        if (confirmResult) {
          const dest = buttons.find(b => b.style === 'destructive' || b.text === 'Discard' || b.text === 'Remove');
          if (dest && dest.onPress) dest.onPress();
        } else {
          const cancelBtn = buttons.find(b => b.style === 'cancel' || b.text === 'Cancel' || b.text === 'Keep Tracking');
          if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
        }
      } else {
        window.alert(`${title}\n\n${message || ''}`);
        if (buttons && buttons[0] && buttons[0].onPress) buttons[0].onPress();
      }
    } else {
      Alert.alert(title, message, buttons as any);
    }
  }
};

export const EMPTY_ARRAY: any[] = [];
export const EMPTY_OBJECT: Record<string, any> = {};

export function mapActiveExercisesToLegacy(exercises: ActiveExercise[]): any[] {
  return exercises.map((exercise) => {
    const completedSets = exercise.sets.filter((set) => set.completed);
    const weights = completedSets.flatMap((set) => set.isUnilateral
      ? [Number(set.leftWeight ?? set.weight) || 0, Number(set.rightWeight ?? set.weight) || 0]
      : [Number(set.weight) || 0]);
    const reps = completedSets.flatMap((set) => set.isUnilateral
      ? [Number(set.leftReps ?? set.reps) || 0, Number(set.rightReps ?? set.reps) || 0]
      : [Number(set.reps) || 0]);
    return {
      id: exercise.id,
      name: exercise.name,
      note: exercise.note,
      showNote: exercise.showNote,
      isNoteLocked: exercise.isNoteLocked,
      autoTimer: exercise.autoTimer,
      variation: exercise.variation,
      useRoutineTargets: exercise.useRoutineTargets,
      sets: exercise.sets.length,
      bestWeight: weights.length ? Math.max(...weights, 0) : 0,
      bestReps: reps.length ? Math.max(...reps, 0) : 0,
      superSetGroupId: exercise.superSetGroupId,
      setsDetails: exercise.sets.map((set) => ({
        id: set.id,
        weight: set.weight ?? '',
        reps: set.reps ?? '',
        suggestedWeight: set.suggestedWeight ?? '',
        suggestedReps: set.suggestedReps ?? '',
        completed: set.completed,
        rpe: set.rpe || undefined,
        category: set.category || 'S',
        isUnilateral: Boolean(set.isUnilateral),
        leftWeight: set.leftWeight,
        leftReps: set.leftReps,
        rightWeight: set.rightWeight,
        rightReps: set.rightReps,
        suggestedLeftWeight: set.suggestedLeftWeight,
        suggestedLeftReps: set.suggestedLeftReps,
        suggestedRightWeight: set.suggestedRightWeight,
        suggestedRightReps: set.suggestedRightReps,
      })),
    };
  });
}

export function formatElapsed(startTime: Date | string | number | null | undefined, offsetSeconds: number = 0): string {
  if (!startTime) return '0:00';
  let startMs: number;
  if (startTime instanceof Date) {
    startMs = startTime.getTime();
  } else if (typeof startTime === 'number') {
    startMs = startTime;
  } else {
    startMs = new Date(startTime).getTime();
  }
  if (isNaN(startMs)) return '0:00';

  const sessionSec = Math.floor((Date.now() - startMs) / 1000);
  const totalSec = Math.max(0, sessionSec + (offsetSeconds || 0));
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;

  const secStr = sec.toString().padStart(2, '0');
  if (h > 0) {
    const minStr = min.toString().padStart(2, '0');
    return `${h}:${minStr}:${secStr}`;
  } else {
    return `${min}:${secStr}`;
  }
}

export const getBestPerformanceSuggestionForSet = (
  exName: string,
  category: string,
  positionInCategory: number,
  sessions: any[],
  isUnilateral: boolean,
  targetVariation?: string,
  exerciseObj?: any,
  sessionsMap?: ExpectedValuesIndex,
  context: ExpectedValueContext = {}
): SetSuggestion => {
  return resolveLastPerformanceSuggestion(
    exName,
    category,
    positionInCategory,
    sessions,
    isUnilateral,
    targetVariation,
    sessionsMap,
    context
  );
  /* Legacy progressive-overload scoring retained below for source compatibility; the
     exact-last-performance resolver above is now the sole runtime policy.
  if (!exName || typeof exName !== 'string') {
    return { weight: '', reps: '', leftWeight: '', leftReps: '', rightWeight: '', rightReps: '' };
  }
  const normTargetExName = exName.toLowerCase().trim();

  const parseWeight = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? 0 : num;
  };
  const parseReps = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'number' ? val : parseInt(val, 10);
    return isNaN(num) ? 0 : num;
  };

  let matchingSessions: any[];
  if (targetVariation !== undefined || exerciseObj !== undefined) {
    const varSessions = getSessionsForExerciseVariation(exName, targetVariation, exerciseObj, sessions || []);
    matchingSessions = varSessions
      .reduce<any[]>((acc, s) => {
        if (s && typeof s === 'object' && Array.isArray(s.exercises)) {
          const ex = s.exercises.find((e: any) => Boolean(e && typeof e === 'object' && e.name && typeof e.name === 'string' && e.name.toLowerCase().trim() === normTargetExName));
          if (ex) {
            acc.push({ datetime: s.datetime, ex });
          }
        }
        return acc;
      }, [])
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  } else if (sessionsMap) {
    matchingSessions = sessionsMap.get(normTargetExName) || [];
  } else {
    matchingSessions = (sessions || [])
      .reduce<any[]>((acc, s) => {
        if (s && typeof s === 'object' && Array.isArray(s.exercises)) {
          const ex = s.exercises.find((e: any) => Boolean(e && typeof e === 'object' && e.name && typeof e.name === 'string' && e.name.toLowerCase().trim() === normTargetExName));
          if (ex) {
            acc.push({ datetime: s.datetime, ex });
          }
        }
        return acc;
      }, [])
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()); // descending (most recent first)
  }

  const last5Sessions = matchingSessions.slice(0, 5);

  if (last5Sessions.length === 0) {
    return {
      weight: '',
      reps: '',
      leftWeight: '',
      leftReps: '',
      rightWeight: '',
      rightReps: '',
    };
  }

  const leftSideCandidates: any[] = [];
  const rightSideCandidates: any[] = [];
  const bilateralCandidates: any[] = [];

  for (const session of last5Sessions) {
    const histEx = session.ex;
    const sets = Array.isArray(histEx.setsDetails) ? histEx.setsDetails : Array.isArray(histEx.sets) ? histEx.sets : [];
    const matchingSets = sets.filter((s: any) => (s.category || 'S') === category);
    const matchedSet = matchingSets[positionInCategory] || matchingSets[matchingSets.length - 1];

    if (matchedSet) {
      const setWeight = matchedSet.weight ?? matchedSet.weightKg;
      const setReps = matchedSet.reps;

      // Left side extraction with fallbacks
      let lw = matchedSet.leftWeight;
      let lr = matchedSet.leftReps;
      if (lw === undefined || lw === null) {
        lw = matchedSet.rightWeight;
        lr = matchedSet.rightReps;
      }
      if (lw === undefined || lw === null) {
        lw = setWeight;
        lr = setReps;
      }

      if (lw !== undefined && lw !== null) {
        leftSideCandidates.push({
          weight: parseWeight(lw),
          reps: parseReps(lr),
          originalWeight: lw,
          originalReps: lr,
          datetime: session.datetime,
        });
      }

      // Right side extraction with fallbacks
      let rw = matchedSet.rightWeight;
      let rr = matchedSet.rightReps;
      if (rw === undefined || rw === null) {
        rw = matchedSet.leftWeight;
        rr = matchedSet.leftReps;
      }
      if (rw === undefined || rw === null) {
        rw = setWeight;
        rr = setReps;
      }

      if (rw !== undefined && rw !== null) {
        rightSideCandidates.push({
          weight: parseWeight(rw),
          reps: parseReps(rr),
          originalWeight: rw,
          originalReps: rr,
          datetime: session.datetime,
        });
      }

      // Bilateral extraction
      if (setWeight !== undefined && setWeight !== null) {
        bilateralCandidates.push({
          weight: parseWeight(setWeight),
          reps: parseReps(setReps),
          originalWeight: setWeight,
          originalReps: setReps,
          datetime: session.datetime,
        });
      }
    }
  }

  const findBestForSide = (
    sideCandidates: { weight: number; reps: number; originalWeight: any; originalReps: any; datetime: string }[]
  ): { weight: string; reps: string } | null => {
    if (sideCandidates.length === 0) return null;

    const allWeightsZero = sideCandidates.every(c => c.weight === 0);

    let bestIndex = 0;
    for (let i = 1; i < sideCandidates.length; i++) {
      const current = sideCandidates[i];
      const best = sideCandidates[bestIndex];

      if (allWeightsZero) {
        if (current.reps > best.reps) {
          bestIndex = i;
        }
      } else {
        const current1RM = current.weight * (1 + current.reps / 30);
        const best1RM = best.weight * (1 + best.reps / 30);
        if (current1RM > best1RM) {
          bestIndex = i;
        }
      }
    }

    const bestCand = sideCandidates[bestIndex];
    return {
      weight: bestCand.originalWeight !== undefined && bestCand.originalWeight !== null ? bestCand.originalWeight.toString() : '',
      reps: bestCand.originalReps !== undefined && bestCand.originalReps !== null ? bestCand.originalReps.toString() : '',
    };
  };

  if (isUnilateral) {
    const leftBest = findBestForSide(leftSideCandidates);
    const rightBest = findBestForSide(rightSideCandidates);

    return {
      weight: leftBest?.weight || rightBest?.weight || '',
      reps: leftBest?.reps || rightBest?.reps || '',
      leftWeight: leftBest?.weight || '',
      leftReps: leftBest?.reps || '',
      rightWeight: rightBest?.weight || '',
      rightReps: rightBest?.reps || '',
    };
  } else {
    const bilateralBest = findBestForSide(bilateralCandidates);
    return {
      weight: bilateralBest?.weight || '',
      reps: bilateralBest?.reps || '',
      leftWeight: bilateralBest?.weight || '',
      leftReps: bilateralBest?.reps || '',
      rightWeight: bilateralBest?.weight || '',
      rightReps: bilateralBest?.reps || '',
    };
  }
  */
};

export const getPreviousSessionSetSuggestion = (
  exName: string,
  category: string,
  positionInCategory: number,
  sessions: any[],
  isUnilateral: boolean,
  workoutName?: string,
  exIdx?: number,
  sessionsMap?: ExpectedValuesIndex,
  context: ExpectedValueContext = {}
): SetSuggestion => {
  return resolveLastPerformanceSuggestion(
    exName,
    category,
    positionInCategory,
    sessions,
    isUnilateral,
    undefined,
    sessionsMap,
    {
      ...context,
      routineName: context.routineName ?? workoutName,
      exercisePosition: context.exercisePosition ?? exIdx,
    }
  );
  /* Legacy tiered matching retained below for source compatibility.
  const cleanStr = (s: string | undefined | null) => (s || '').trim().toLowerCase();

  const formatVal = (val: any): string => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num) || num === 0) return '';
    return num.toString();
  };

  const extractSetVals = (setObj: any) => {
    const weight = formatVal(setObj.weight ?? setObj.weightKg ?? setObj.suggestedWeight);
    const reps = formatVal(setObj.reps ?? setObj.suggestedReps);
    const lw = formatVal(setObj.leftWeight) || weight;
    const lr = formatVal(setObj.leftReps) || reps;
    const rw = formatVal(setObj.rightWeight) || weight;
    const rr = formatVal(setObj.rightReps) || reps;
    return { weight, reps, lw, lr, rw, rr };
  };

  const hasValidVals = (v: ReturnType<typeof extractSetVals>) => Boolean(v.weight || v.reps || v.lw || v.rw);

  const targetExClean = cleanStr(exName);
  const targetRoutineClean = cleanStr(workoutName);

  if (!targetExClean || !sessions || sessions.length === 0) {
    return { weight: '', reps: '', leftWeight: '', leftReps: '', rightWeight: '', rightReps: '' };
  }

  // Pre-sort sessions descending by datetime (most recent first)
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  let bestMatchVals: ReturnType<typeof extractSetVals> | null = null;

  // Tier 1: Same Routine, Same Exercise Order Position (exIdx), Same Set Number (positionInCategory)
  if (targetRoutineClean && exIdx !== undefined && exIdx >= 0) {
    for (const s of sortedSessions) {
      if (cleanStr(s.title) === targetRoutineClean && Array.isArray(s.exercises)) {
        const exAtPos = s.exercises[exIdx];
        if (exAtPos && cleanStr(exAtPos.name) === targetExClean) {
          const sets = Array.isArray(exAtPos.setsDetails) ? exAtPos.setsDetails : Array.isArray(exAtPos.sets) ? exAtPos.sets : [];
          const matchingCatSets = sets.filter((st: any) => (st.category || 'S') === category);
          const candidateSet = matchingCatSets[positionInCategory];
          if (candidateSet) {
            const vals = extractSetVals(candidateSet);
            if (hasValidVals(vals)) {
              bestMatchVals = vals;
              break;
            }
          }
        }
      }
    }
  }

  // Tier 2: Same Routine, Same Exercise, Same Set Number
  if (!bestMatchVals && targetRoutineClean) {
    for (const s of sortedSessions) {
      if (cleanStr(s.title) === targetRoutineClean && Array.isArray(s.exercises)) {
        const histEx = s.exercises.find((e: any) => e.name && cleanStr(e.name) === targetExClean);
        if (histEx) {
          const sets = Array.isArray(histEx.setsDetails) ? histEx.setsDetails : Array.isArray(histEx.sets) ? histEx.sets : [];
          const matchingCatSets = sets.filter((st: any) => (st.category || 'S') === category);
          const candidateSet = matchingCatSets[positionInCategory];
          if (candidateSet) {
            const vals = extractSetVals(candidateSet);
            if (hasValidVals(vals)) {
              bestMatchVals = vals;
              break;
            }
          }
        }
      }
    }
  }

  // Tier 3: Same Exercise Order Position (exIdx), Same Set Number (Any Routine)
  if (!bestMatchVals && exIdx !== undefined && exIdx >= 0) {
    for (const s of sortedSessions) {
      if (Array.isArray(s.exercises)) {
        const exAtPos = s.exercises[exIdx];
        if (exAtPos && cleanStr(exAtPos.name) === targetExClean) {
          const sets = Array.isArray(exAtPos.setsDetails) ? exAtPos.setsDetails : Array.isArray(exAtPos.sets) ? exAtPos.sets : [];
          const matchingCatSets = sets.filter((st: any) => (st.category || 'S') === category);
          const candidateSet = matchingCatSets[positionInCategory];
          if (candidateSet) {
            const vals = extractSetVals(candidateSet);
            if (hasValidVals(vals)) {
              bestMatchVals = vals;
              break;
            }
          }
        }
      }
    }
  }

  // Tier 4: Same Exercise, Same Set Number (Any Routine)
  if (!bestMatchVals) {
    for (const s of sortedSessions) {
      if (Array.isArray(s.exercises)) {
        const histEx = s.exercises.find((e: any) => e.name && cleanStr(e.name) === targetExClean);
        if (histEx) {
          const sets = Array.isArray(histEx.setsDetails) ? histEx.setsDetails : Array.isArray(histEx.sets) ? histEx.sets : [];
          const matchingCatSets = sets.filter((st: any) => (st.category || 'S') === category);
          const candidateSet = matchingCatSets[positionInCategory];
          if (candidateSet) {
            const vals = extractSetVals(candidateSet);
            if (hasValidVals(vals)) {
              bestMatchVals = vals;
              break;
            }
          }
        }
      }
    }
  }

  // Tier 5: Same Exercise, Closest or Last Logged Set (Any Routine)
  if (!bestMatchVals) {
    for (const s of sortedSessions) {
      if (Array.isArray(s.exercises)) {
        const histEx = s.exercises.find((e: any) => e.name && cleanStr(e.name) === targetExClean);
        if (histEx) {
          const sets = Array.isArray(histEx.setsDetails) ? histEx.setsDetails : Array.isArray(histEx.sets) ? histEx.sets : [];
          const matchingCatSets = sets.filter((st: any) => (st.category || 'S') === category);
          const candidateSet = matchingCatSets[positionInCategory] || matchingCatSets[matchingCatSets.length - 1] || sets[sets.length - 1];
          if (candidateSet) {
            const vals = extractSetVals(candidateSet);
            if (hasValidVals(vals)) {
              bestMatchVals = vals;
              break;
            }
          }
        }
      }
    }
  }

  if (!bestMatchVals) {
    return { weight: '', reps: '', leftWeight: '', leftReps: '', rightWeight: '', rightReps: '' };
  }

  if (isUnilateral) {
    return {
      weight: bestMatchVals.lw || bestMatchVals.rw || bestMatchVals.weight || '',
      reps: bestMatchVals.lr || bestMatchVals.rr || bestMatchVals.reps || '',
      leftWeight: bestMatchVals.lw || '',
      leftReps: bestMatchVals.lr || '',
      rightWeight: bestMatchVals.rw || '',
      rightReps: bestMatchVals.rr || '',
    };
  }

  return {
    weight: bestMatchVals.weight || '',
    reps: bestMatchVals.reps || '',
    leftWeight: bestMatchVals.weight || '',
    leftReps: bestMatchVals.reps || '',
    rightWeight: bestMatchVals.weight || '',
    rightReps: bestMatchVals.reps || '',
  };
  */
};

export const serializeState = (exercises: any[], note: string): string => {
  try {
    const serializedExs = exercises.map(ex => ({
      name: ex.name,
      sets: (ex.sets || []).map((s: any) => ({
        weight: s.weight?.toString() || '',
        reps: s.reps?.toString() || '',
        completed: !!s.completed,
        rpe: s.rpe?.toString() || '',
        category: s.category || 'S',
        isUnilateral: !!s.isUnilateral,
        leftWeight: s.leftWeight?.toString() || '',
        leftReps: s.leftReps?.toString() || '',
        rightWeight: s.rightWeight?.toString() || '',
        rightReps: s.rightReps?.toString() || '',
      }))
    }));
    return JSON.stringify({ note, exercises: serializedExs });
  } catch (e) {
    return '';
  }
};

// Contiguous supersets verification & dissolution helper (Reference-Preserving for 60 FPS Reorders)
export function sanitizeSuperSets<T extends { superSetGroupId?: string }>(items: T[]): T[] {
  if (!items || items.length === 0) return items;

  const seenGroups = new Set<string>();
  let lastGroupId: string | undefined = undefined;
  const targetGroupIds: (string | undefined)[] = new Array(items.length);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const gid = item.superSetGroupId;
    if (!gid) {
      lastGroupId = undefined;
      targetGroupIds[idx] = undefined;
      continue;
    }

    if (seenGroups.has(gid) && lastGroupId !== gid) {
      const newGid = `ss-split-${Date.now()}-${idx}-${Math.random()}`;
      lastGroupId = newGid;
      targetGroupIds[idx] = newGid;
    } else {
      seenGroups.add(gid);
      lastGroupId = gid;
      targetGroupIds[idx] = gid;
    }
  }

  const groupCounts: Record<string, number> = {};
  for (let idx = 0; idx < items.length; idx++) {
    const tg = targetGroupIds[idx];
    if (tg) {
      groupCounts[tg] = (groupCounts[tg] || 0) + 1;
    }
  }

  let hasChanges = false;
  const result: T[] = new Array(items.length);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    let finalGid = targetGroupIds[idx];

    if (finalGid && groupCounts[finalGid] < 2) {
      finalGid = undefined;
    }

    if (item.superSetGroupId === finalGid) {
      result[idx] = item;
    } else {
      hasChanges = true;
      result[idx] = { ...item, superSetGroupId: finalGid };
    }
  }

  return hasChanges ? result : items;
}
