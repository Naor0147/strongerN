// src/utils/insights.ts

export interface ExerciseInsight {
  exerciseName: string;
  isFirstTime: boolean;
  status: 'progress' | 'neutral' | 'regression' | 'first';
  currentBestWeight: number;
  prevBestWeight?: number;
  currentBestReps: number;
  prevBestReps?: number;
  currentVolume: number;
  prevVolume?: number;
  currentE1RM: number;
  prevE1RM?: number;
  changeVolumePercent?: number;
  changeE1RMPercent?: number;
  details: string[];
}

const calculateE1RM = (weight: number, reps: number): number => {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
};

export const generateWorkoutInsights = (
  currentExercises: any[],
  pastSessions: any[],
  locale: 'en' | 'he'
): ExerciseInsight[] => {
  const insights: ExerciseInsight[] = [];
  const isHe = locale === 'he';

  for (const currentEx of currentExercises) {
    const currentCompletedSets = currentEx.setsDetails?.filter((s: any) => s.completed) || [];
    if (currentCompletedSets.length === 0) continue;

    // Compute current metrics
    const currentBestWeight = Math.max(...currentCompletedSets.map((s: any) => s.weight), 0);
    const currentBestReps = Math.max(...currentCompletedSets.map((s: any) => s.reps), 0);
    const currentVolume = currentCompletedSets.reduce((sum: number, s: any) => sum + (s.weight * s.reps), 0);
    const currentE1RM = Math.max(...currentCompletedSets.map((s: any) => calculateE1RM(s.weight, s.reps)), 0);

    // Find the most recent session containing this exercise
    let prevEx: any = null;
    for (const session of pastSessions) {
      // Find matching exercise that has completed sets
      const found = session.exercises?.find((e: any) => e.name === currentEx.name);
      if (found) {
        // Support both array setsDetails and simple sets count
        const prevCompleted = found.setsDetails?.filter((s: any) => s.completed) || [];
        if (prevCompleted.length > 0) {
          prevEx = found;
          break;
        }
      }
    }

    if (!prevEx) {
      // First time performing
      insights.push({
        exerciseName: currentEx.name,
        isFirstTime: true,
        status: 'first',
        currentBestWeight,
        currentBestReps,
        currentVolume,
        currentE1RM,
        details: [
          isHe
            ? 'פעם ראשונה שאתה מבצע את התרגיל הזה! התחלה מצוינת למעקב אחר ההתקדמות שלך. 🚀'
            : 'First time performing this exercise! A great start to tracking your progress. 🚀'
        ]
      });
      continue;
    }

    const prevCompletedSets = prevEx.setsDetails.filter((s: any) => s.completed);
    const prevBestWeight = Math.max(...prevCompletedSets.map((s: any) => s.weight), 0);
    const prevBestReps = Math.max(...prevCompletedSets.map((s: any) => s.reps), 0);
    const prevVolume = prevCompletedSets.reduce((sum: number, s: any) => sum + (s.weight * s.reps), 0);
    const prevE1RM = Math.max(...prevCompletedSets.map((s: any) => calculateE1RM(s.weight, s.reps)), 0);

    const changeVolumePercent = prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : 0;
    const changeE1RMPercent = prevE1RM > 0 ? ((currentE1RM - prevE1RM) / prevE1RM) * 100 : 0;

    const details: string[] = [];

    // Best Weight Change
    if (currentBestWeight > prevBestWeight) {
      const diff = (currentBestWeight - prevBestWeight).toFixed(1);
      details.push(
        isHe
          ? `משקל מירבי: ${currentBestWeight} ק"ג לעומת ${prevBestWeight} ק"ג (+${diff} ק"ג) 🔥`
          : `Best weight: ${currentBestWeight}kg vs previous ${prevBestWeight}kg (+${diff}kg) 🔥`
      );
    } else if (currentBestWeight < prevBestWeight) {
      const diff = (prevBestWeight - currentBestWeight).toFixed(1);
      details.push(
        isHe
          ? `משקל מירבי: ${currentBestWeight} ק"ג לעומת ${prevBestWeight} ק"ג (-${diff} ק"ג)`
          : `Best weight: ${currentBestWeight}kg vs previous ${prevBestWeight}kg (-${diff}kg)`
      );
    }

    // Volume Change
    if (changeVolumePercent > 0.5) {
      details.push(
        isHe
          ? `נפח כולל: ${Math.round(currentVolume)} ק"ג (+${Math.round(changeVolumePercent)}%) 📈`
          : `Total volume: ${Math.round(currentVolume)}kg (+${Math.round(changeVolumePercent)}%) 📈`
      );
    } else if (changeVolumePercent < -0.5) {
      details.push(
        isHe
          ? `נפח כולל: ${Math.round(currentVolume)} ק"ג (${Math.round(changeVolumePercent)}%)`
          : `Total volume: ${Math.round(currentVolume)}kg (${Math.round(changeVolumePercent)}%)`
      );
    }

    // Estimated 1RM Change
    if (changeE1RMPercent > 0.5) {
      details.push(
        isHe
          ? `1RM מוערך: ${currentE1RM.toFixed(1)} ק"ג (+${Math.round(changeE1RMPercent)}%) 💪`
          : `Estimated 1RM: ${currentE1RM.toFixed(1)}kg (+${Math.round(changeE1RMPercent)}%) 💪`
      );
    } else if (changeE1RMPercent < -0.5) {
      details.push(
        isHe
          ? `1RM מוערך: ${currentE1RM.toFixed(1)} ק"ג (${Math.round(changeE1RMPercent)}%)`
          : `Estimated 1RM: ${currentE1RM.toFixed(1)}kg (${Math.round(changeE1RMPercent)}%)`
      );
    }

    // Compare set-by-set (up to the minimum length of sets in both sessions)
    const maxCompareSets = Math.min(currentCompletedSets.length, prevCompletedSets.length);
    for (let i = 0; i < maxCompareSets; i++) {
      const currSet = currentCompletedSets[i];
      const prevSet = prevCompletedSets[i];
      const setNum = i + 1;

      if (currSet.weight > prevSet.weight && currSet.reps >= prevSet.reps) {
        const diffW = (currSet.weight - prevSet.weight).toFixed(1);
        details.push(
          isHe
            ? `סט ${setNum}: העלאת משקל מ-${prevSet.weight} ק"ג ל-${currSet.weight} ק"ג (+${diffW} ק"ג)`
            : `Set ${setNum}: Increased weight from ${prevSet.weight}kg to ${currSet.weight}kg (+${diffW}kg)`
        );
      } else if (currSet.weight === prevSet.weight && currSet.reps > prevSet.reps) {
        const diffR = currSet.reps - prevSet.reps;
        details.push(
          isHe
            ? `סט ${setNum}: העלאת חזרות מ-${prevSet.reps} ל-${currSet.reps} (+${diffR} חזרות)`
            : `Set ${setNum}: Increased reps from ${prevSet.reps} to ${currSet.reps} (+${diffR} reps)`
        );
      } else if (currSet.weight === prevSet.weight && currSet.reps < prevSet.reps) {
        const diffR = prevSet.reps - currSet.reps;
        details.push(
          isHe
            ? `סט ${setNum}: ירידה בחזרות מ-${prevSet.reps} ל-${currSet.reps} (-${diffR} חזרות)`
            : `Set ${setNum}: Reps decreased from ${prevSet.reps} to ${currSet.reps} (-${diffR} reps)`
        );
      }
    }

    // Unusual Changes checks
    // 1. Significant strength drop
    if (changeE1RMPercent <= -15) {
      details.push(
        isHe
          ? `⚠️ ירידה חריגה: הכוח המוערך ירד ב-${Math.round(Math.abs(changeE1RMPercent))}%! בדוק עייפות או סטים מסוג Drop sets.`
          : `⚠️ Unusual drop: Estimated strength decreased by ${Math.round(Math.abs(changeE1RMPercent))}%! Take note if fatigued or doing drop sets.`
      );
    }
    // 2. Exceptional progression
    else if (changeE1RMPercent >= 20) {
      details.push(
        isHe
          ? `⭐ התקדמות חריגה! עלייה של ${Math.round(changeE1RMPercent)}% בכוח המוערך.`
          : `⭐ Exceptional progress! Strength increased by ${Math.round(changeE1RMPercent)}%.`
      );
    }

    // 3. Significant rep drop set-by-set at same weight
    for (let i = 0; i < maxCompareSets; i++) {
      const currSet = currentCompletedSets[i];
      const prevSet = prevCompletedSets[i];
      if (currSet.weight === prevSet.weight && prevSet.reps - currSet.reps >= 4) {
        const diffR = prevSet.reps - currSet.reps;
        details.push(
          isHe
            ? `⚠️ ירידה חריגה בסט ${i + 1}: נפילה של ${diffR} חזרות באותו משקל (${currSet.weight} ק"ג).`
            : `⚠️ Unusual rep drop on Set ${i + 1}: Dropped ${diffR} reps at the same weight (${currSet.weight}kg).`
        );
      }
    }

    // Assign overall status
    let status: 'progress' | 'neutral' | 'regression' | 'first' = 'neutral';
    if (changeE1RMPercent > 1) {
      status = 'progress';
    } else if (changeE1RMPercent < -5) {
      status = 'regression';
    }

    insights.push({
      exerciseName: currentEx.name,
      isFirstTime: false,
      status,
      currentBestWeight,
      prevBestWeight,
      currentBestReps,
      prevBestReps,
      currentVolume,
      prevVolume,
      currentE1RM,
      prevE1RM,
      changeVolumePercent,
      changeE1RMPercent,
      details
    });
  }

  return insights;
};
