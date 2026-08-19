# Milestone 1 (R5: Exercise History Breakdown & Virtualization) — Investigation Handoff Report

## 1. Observation

### A. Pure Engine: `src/utils/exerciseHistory.ts`
- **File**: `c:\Antigravity\strongerN\src\utils\exerciseHistory.ts` (162 lines)
- **Exports**:
  - `interface ExerciseHistorySet`: `{ setNumber: number; weightKg: number; reps: number; completed: boolean; category: 'W' | 'S' | 'D' | 'F'; rpe?: number; est1RM: number; isUnilateral?: boolean; leftWeightKg?: number; leftReps?: number; rightWeightKg?: number; rightReps?: number; }`
  - `interface ExerciseHistorySession`: `{ id: string; date: Date; workoutTitle: string; sets: ExerciseHistorySet[]; completedSetsCount: number; bestSet: ExerciseHistorySet | null; best1RM: number; isPr1RM: boolean; isPrWeight: boolean; }`
  - `function buildExerciseSessionHistory(exerciseName: string, sessions: any[]): ExerciseHistorySession[]`
- **Implementation Mechanism**:
  - Validates inputs (`lines 41-43`).
  - Sorts sessions chronologically (`lines 49-53`) to establish accurate historical progression of Personal Records (`runningMax1RM`, `runningMaxWeight`).
  - Filters exercises by target name (`name` or `nameSnapshot`, trimmed case-insensitive, `lines 63-66`).
  - Normalizes raw sets from `matchedEx.setsDetails` or `matchedEx.sets` (`lines 70-74`), calculating estimated 1RM via `estimate1RM(weightKg, reps)` and completion status via `isCompletedSet(s)`.
  - Sets PR flags: `isPr1RM = true` if `best1RM > runningMax1RM`, `isPrWeight = true` if `sessionMaxWeight > runningMaxWeight` (`lines 130-141`).
  - Returns sessions sorted descending (newest first, `line 160`).
- **Minor Defect in Category Default**:
  - In `exerciseHistory.ts:89`: `const category = (s.category || 'W') as 'W' | 'S' | 'D' | 'F';`
  - Un-categorized sets currently default to `'W'` (Warmup). In StrongerN domain contracts (`src/storage/contracts/validators.ts:119` & `src/storage/history/legacySessionMapper.ts:48`), standard working sets default to `'S'`. This should be updated to `(s.category || 'S')`.

### B. Current Modal Implementation: `src/screens/ExerciseInsightsModal.tsx`
- **File**: `c:\Antigravity\strongerN\src\screens\ExerciseInsightsModal.tsx` (1090 lines)
- **Current History Tab** (`lines 569-728`):
  - Wrapped inside the global modal `<ScrollView contentContainerStyle={styles.scrollContent}>` (`line 303`).
  - Computes history inline using `.reduce()` (`lines 573-603`) on every render pass, completely bypassing `exerciseHistory.ts`.
  - Renders all sessions via non-virtualized mapping: `<View style={styles.historyList}>{sortedHistory.map(...)}</View>` (`lines 621-713`).
  - Lacks PR badges (`isPr1RM`, `isPrWeight`), workout titles, completed set indicators, set category badges, unilateral details, and RPE.
  - State `expandedSessions` (`Record<string, boolean>`) and `toggleSessionExpand(sessionId)` (`lines 135, 142-148`) already provide the state mechanism for accordion expansion.

### C. Design System & Theme Token Compliance
- **File**: `c:\Antigravity\strongerN\src\theme.ts` & `c:\Antigravity\strongerN\UI_UX_README.md`
- Base background: `colors.bg` (`#0D0F14`).
- Containers/Cards: `colors.surface` (`#161B24`), border `colors.border` (`#252D3A`), radius `radius.md` (`16`).
- PR 1RM Badge: `colors.highlight` (`#38BDF8`) with `colors.highlightGlow` (`#38BDF820`).
- Max Weight PR Badge: `colors.gold` (`#6366F1`) with `colors.goldGlow` (`#6366F120`).
- Category Indicators: Warmup `colors.textMuted` (`#4E5A6E`), Drop `colors.highlight` (`#38BDF8`), Failure `colors.error` (`#F0506E`), Standard `colors.accent` (`#4F8EF7`).
- Ripples: `android_ripple={ripple.surface}` on Pressable cards.
- Typography: `font.regular`, `font.medium`, `font.semibold`, `font.bold`, `font.sizes.*`.

---

## 2. Logic Chain

1. **Virtualization Anti-Pattern Elimination**:
   - *Observation*: `ExerciseInsightsModal.tsx:303` wraps all tabs in a single `<ScrollView>`.
   - *React Native Principle*: Placing a vertical `FlatList` inside a vertical `ScrollView` disables virtualization windowing and throws console warnings.
   - *Resolution*: Conditionally render `<ScrollView>` for `'info'` and `'data'` tabs, and render `<FlatList>` as the top-level container for `'history'` tab.

2. **Integration of Pure History Engine**:
   - *Observation*: `ExerciseInsightsModal.tsx` recalculates history inline on line 573.
   - *Resolution*: Replace inline reducer with `const historyData = useMemo(() => buildExerciseSessionHistory(exerciseName, sessions), [exerciseName, sessions]);`.

3. **Session Card Enhancement**:
   - *Observation*: Users need to see which sessions broke records, what workout routine they performed, and set-by-set breakdown.
   - *Resolution*: Render session cards featuring:
     - Header: Workout Title (`item.workoutTitle`), Date (`DD.MM.YYYY`), and PR Badges (`PR 1RM` and `MAX WT`).
     - Stat Summary Row: Best Set (`${weightKg}kg × ${reps}`), Est 1RM (`${best1RM}kg`), and Completed Ratio (`${completedSetsCount}/${sets.length}`).
     - Expandable Set Breakdown: Accordion toggle showing set number, category pill (if non-standard), reps × weight, unilateral breakdown (L/R), and RPE.

---

## 3. Caveats

1. **Legacy Mock and Storage Sessions**: Sessions may have `setsDetails` (array of objects), `sets` (array of objects), or legacy `sets` (number). `buildExerciseSessionHistory` correctly parses all three.
2. **Exercise Naming Variations**: Exercises may match by exact name or `nameSnapshot`. `buildExerciseSessionHistory` already compares `targetName = exerciseName.toLowerCase().trim()`.
3. **Empty Data Handling**: When no sessions exist for an exercise, `historyData` is `[]`. `FlatList` must render `ListEmptyComponent` matching the existing empty state view with `noHistoryFound`.

---

## 4. Conclusion

The Milestone 1 (R5) implementation requires:
1. **Fix `src/utils/exerciseHistory.ts`**:
   - Line 89: Change `(s.category || 'W')` to `(s.category || 'S')`.
2. **Refactor `src/screens/ExerciseInsightsModal.tsx`**:
   - Import `buildExerciseSessionHistory, ExerciseHistorySession, ExerciseHistorySet` from `../utils/exerciseHistory`.
   - Derive `historyData` via `useMemo`.
   - Separate tab containers: `<ScrollView>` for `'info'` and `'data'`, `<FlatList>` for `'history'`.
   - Implement `renderHistoryCard` with session header, PR badges (`isPr1RM`, `isPrWeight`), stat summary, and collapsible set details.
   - Wire `expandedSessions` state and `toggleSessionExpand` to accordion toggle.
3. **Create `src/__tests__/r5_exerciseHistory.test.ts`**:
   - Complete unit and component test suite covering engine logic, PR detection, unilateral sets, and virtualization rendering.

---

## 5. Verification Method

### Test Plan for `src/__tests__/r5_exerciseHistory.test.ts`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  buildExerciseSessionHistory,
  ExerciseHistorySession,
  ExerciseHistorySet,
} from '../utils/exerciseHistory';
import ExerciseInsightsModal from '../screens/ExerciseInsightsModal';

describe('R5 Exercise History Breakdown & Virtualization', () => {
  describe('buildExerciseSessionHistory engine', () => {
    it('returns empty array for invalid or empty sessions', () => {
      expect(buildExerciseSessionHistory('', [])).toEqual([]);
      expect(buildExerciseSessionHistory('Bench Press', null as any)).toEqual([]);
      expect(buildExerciseSessionHistory('Bench Press', [])).toEqual([]);
    });

    it('filters sessions matching target exercise case-insensitively and trimmed', () => {
      const sessions = [
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Push Day',
          exercises: [{ name: '  Bench Press  ', setsDetails: [{ weightKg: 100, reps: 5, completed: true }] }],
        },
        {
          id: 'sess-2',
          datetime: '2026-01-02T10:00:00Z',
          title: 'Leg Day',
          exercises: [{ name: 'Squat', setsDetails: [{ weightKg: 140, reps: 5, completed: true }] }],
        },
      ];
      const result = buildExerciseSessionHistory('bench press', sessions);
      expect(result).toHaveLength(1);
      expect(result[0].workoutTitle).toBe('Push Day');
      expect(result[0].sets).toHaveLength(1);
    });

    it('sorts output descending (newest first) and computes chronological PR flags accurately', () => {
      const sessions = [
        {
          id: 'sess-3',
          datetime: '2026-03-01T10:00:00Z',
          title: 'Workout 3',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 60, reps: 5, completed: true }] }], // 1RM ~70kg (lower than sess-2)
        },
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Workout 1',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 50, reps: 5, completed: true }] }], // 1RM ~58kg -> PR 1RM & PR Weight
        },
        {
          id: 'sess-2',
          datetime: '2026-02-01T10:00:00Z',
          title: 'Workout 2',
          exercises: [{ name: 'Overhead Press', setsDetails: [{ weightKg: 70, reps: 5, completed: true }] }], // 1RM ~81kg -> PR 1RM & PR Weight
        },
      ];

      const result = buildExerciseSessionHistory('Overhead Press', sessions);
      expect(result).toHaveLength(3);
      // Newest first
      expect(result[0].id).toBe('sess-3');
      expect(result[0].isPr1RM).toBe(false);
      expect(result[0].isPrWeight).toBe(false);

      expect(result[1].id).toBe('sess-2');
      expect(result[1].isPr1RM).toBe(true);
      expect(result[1].isPrWeight).toBe(true);

      expect(result[2].id).toBe('sess-1');
      expect(result[2].isPr1RM).toBe(true);
      expect(result[2].isPrWeight).toBe(true);
    });

    it('ignores incomplete sets when computing best1RM, bestSet, and PR flags', () => {
      const sessions = [
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Chest Day',
          exercises: [
            {
              name: 'Incline Dumbbell Press',
              setsDetails: [
                { weightKg: 30, reps: 10, completed: true },
                { weightKg: 50, reps: 10, completed: false }, // Incomplete heavy set
              ],
            },
          ],
        },
      ];

      const result = buildExerciseSessionHistory('Incline Dumbbell Press', sessions);
      expect(result[0].completedSetsCount).toBe(1);
      expect(result[0].bestSet?.weightKg).toBe(30);
      expect(result[0].best1RM).toBeLessThan(50);
    });

    it('preserves unilateral fields and set categories', () => {
      const sessions = [
        {
          id: 'sess-1',
          datetime: '2026-01-01T10:00:00Z',
          title: 'Arms',
          exercises: [
            {
              name: 'Dumbbell Curl',
              setsDetails: [
                {
                  weightKg: 16,
                  reps: 12,
                  completed: true,
                  category: 'D',
                  isUnilateral: true,
                  leftWeightKg: 16,
                  leftReps: 12,
                  rightWeightKg: 16,
                  rightReps: 12,
                  rpe: 9,
                },
              ],
            },
          ],
        },
      ];

      const result = buildExerciseSessionHistory('Dumbbell Curl', sessions);
      const set = result[0].sets[0];
      expect(set.category).toBe('D');
      expect(set.isUnilateral).toBe(true);
      expect(set.leftWeightKg).toBe(16);
      expect(set.rpe).toBe(9);
    });
  });

  describe('ExerciseInsightsModal History Tab UI Integration', () => {
    const mockSessions = [
      {
        id: 'sess-pr',
        datetime: '2026-02-15T10:00:00Z',
        title: 'Push Power',
        exercises: [
          {
            name: 'Bench Press',
            setsDetails: [
              { weightKg: 100, reps: 5, completed: true, category: 'S' },
              { weightKg: 105, reps: 3, completed: true, category: 'S' },
            ],
          },
        ],
      },
    ];

    it('renders virtualized history session cards with PR badge and expands set details on press', () => {
      const { getByText, queryByText } = render(
        <ExerciseInsightsModal
          visible={true}
          exerciseName="Bench Press"
          sessions={mockSessions as any}
          onClose={jest.fn()}
        />
      );

      // Switch to History tab
      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);

      // Verify session card renders
      expect(getByText('Push Power')).toBeTruthy();
      expect(getByText(/PR/i)).toBeTruthy();

      // Tap card to expand details
      fireEvent.press(getByText('Push Power'));

      // Verify set rows are visible
      expect(getByText(/105/)).toBeTruthy();
      expect(getByText(/100/)).toBeTruthy();
    });

    it('renders empty history fallback when no session history matches', () => {
      const { getByText } = render(
        <ExerciseInsightsModal
          visible={true}
          exerciseName="NonExistent Exercise"
          sessions={mockSessions as any}
          onClose={jest.fn()}
        />
      );

      const historyTab = getByText(/History|היסטוריה/i);
      fireEvent.press(historyTab);

      expect(getByText(/No training history found/i)).toBeTruthy();
    });
  });
});
```
