export interface Diagnosis {
  source: string;
  anchor: string;
  fix: string;
}

export const DIAGNOSES = {
  sheet_closed_on_web_drag: {
    source: 'src/components/layout/ActiveWorkoutModal.tsx',
    anchor: 'isTimerPickerVisible && activeExerciseMenuIndex !== null',
    fix: 'Sheet closed on drag release. DOM click from mouseup bubbles to backdrop. ' +
         'Ensure onClick stopPropagation is on the Animated.View sheet card.',
  },
  backdrop_tap_not_closing_sheet: {
    source: 'src/components/layout/ActiveWorkoutModal.tsx',
    anchor: 'onPress={() => setIsTimerPickerVisible(false)}',
    fix: 'Backdrop tap did not close sheet. Check backdrop Pressable onPress handler.',
  },
} satisfies Record<string, Diagnosis>;

export type DiagnosisId = keyof typeof DIAGNOSES;
