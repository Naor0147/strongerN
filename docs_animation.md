# Animation System Documentation — strongerN

This document describes all the animations implemented across the strongerN app, including where they trigger, their default durations/spring parameters, and how they dynamically scale based on the user's global animation speed multiplier setting.

## Centralized Animation Configuration (`theme.ts`)
Animation speeds are controlled by the central design token system in [theme.ts](file:///C:/Antigravity/strongerN/src/theme.ts). The file exposes a mutable `globalAnimation` object:

```typescript
export const globalAnimation = {
  speed: 1, // Scaled dynamically from settings: 0x (instant) to 2x (slow)
};
```

Two key helpers are exported from [theme.ts](file:///C:/Antigravity/strongerN/src/theme.ts) to scale durations and spring physics:

1. **`getScaledDuration(baseDuration: number): number`**:
   Scales time-based transitions: `baseDuration * globalAnimation.speed`.
2. **`getSpringConfig(baseStiffness, baseDamping, baseMass)`**:
   Dynamically calculates spring parameters to maintain motion characteristics at different speeds:
   - `stiffness = baseStiffness / (speed * speed)`
   - `damping = baseDamping / speed`
   - If `speed === 0` (instant), the spring configuration resolves immediately to an instant snap.

---

## Screen-by-Screen Animation Registry

### 1. Account Launch / Onboarding Screen ([LoginScreen.tsx](file:///C:/Antigravity/strongerN/src/screens/LoginScreen.tsx))
- **Entry Transition (Fade + Slide)**:
  - **Trigger**: Screen mounting.
  - **Type**: Time-based parallel timing.
  - **Default Duration**: `600ms`.
  - **Behavior at 0x**: Instant opacity `1` and vertical position `0`.
- **Pulsing Dumbbell Logo Loop**:
  - **Trigger**: Constant loop while the screen is shown.
  - **Type**: Parallel scale (native) and opacity (JS) timing loops.
  - **Default Duration**: `1400ms` per pulse phase.
  - **Behavior at 0x**: Stays static at scale `1` and opacity `0.15` (does not loop).
- **Data Info Card Collapsible**:
  - **Trigger**: Tapping the "Where is my data stored?" card.
  - **Type**: Height timing interpolation.
  - **Default Duration**: `250ms`.
  - **Behavior at 0x**: Expands/collapses instantly.

### 2. Main Navigation Tab Transitions ([BottomTabBar.tsx](file:///C:/Antigravity/strongerN/src/components/layout/BottomTabBar.tsx))
- **Active Tab Scale Bounce**:
  - **Trigger**: Tapping a tab in the bottom bar.
  - **Type**: Native spring scale interpolation.
  - **Default Springs**: `stiffness: 140`, `damping: 16`.
  - **Behavior at 0x**: Tab scales to `1` instantly without bouncing.

### 3. Workout Dashboard / Settings Entry ([ProfileScreen.tsx](file:///C:/Antigravity/strongerN/src/screens/ProfileScreen.tsx))
- **Entry Transition (Fade + Slide)**:
  - **Trigger**: Screen mounting.
  - **Type**: Time-based timing.
  - **Default Duration**: `450ms`.
  - **Behavior at 0x**: Appears instantly.

### 4. Active Workout Tracker ([ActiveWorkoutModal.tsx](file:///C:/Antigravity/strongerN/src/components/layout/ActiveWorkoutModal.tsx))
- **Active Workout Status Bar Pulsing Dot**:
  - **Trigger**: Constant loop when a workout is active ([ActiveWorkoutBar.tsx](file:///C:/Antigravity/strongerN/src/components/layout/ActiveWorkoutBar.tsx)).
  - **Type**: Timing loop.
  - **Default Duration**: `700ms` per pulse phase.
  - **Behavior at 0x**: Stays static at opacity `1`.
- **Active Rest Timer Pulse**:
  - **Trigger**: Starts looping when the rest countdown is active.
  - **Type**: Parallel timing sequence loop.
  - **Default Duration**: `500ms` per pulse phase.
  - **Behavior at 0x**: Stays static at scale/opacity `1`.
- **Set Swipe-to-Delete Row**:
  - **Trigger**: Dragging a workout set row.
  - **Type**: Spring snap (for release) & timing slide-out (for swipe action).
  - **Default Duration/Spring**: `150ms` timing for delete slide, stiffness `140` and damping `16` for release snap.
  - **Behavior at 0x**: Snaps open or closed instantly on release; deletes instantly on button tap.

### 5. Routine Editor ([RoutineEditorModal.tsx](file:///C:/Antigravity/strongerN/src/components/layout/RoutineEditorModal.tsx))
- **Exercise Swipe-to-Delete Row**:
  - **Trigger**: Dragging an exercise row in the routine builder.
  - **Type**: Same spring/timing pattern as `ActiveWorkoutModal` set rows.

### 6. Exercise Catalog ([ExercisesScreen.tsx](file:///C:/Antigravity/strongerN/src/screens/ExercisesScreen.tsx))
- **Entry Transition (Fade + Slide)**:
  - **Trigger**: Screen mounting.
  - **Type**: Timing sequence.
  - **Default Duration**: `350ms`.
  - **Behavior at 0x**: Appears instantly.

### 7. Workout History ([HistoryScreen.tsx](file:///C:/Antigravity/strongerN/src/screens/HistoryScreen.tsx))
- **Entry Transition (Fade + Slide)**:
  - **Trigger**: Screen mounting.
  - **Type**: Timing sequence.
  - **Default Duration**: `350ms`.
  - **Behavior at 0x**: Appears instantly.

### 8. Measurement Logs ([MeasureScreen.tsx](file:///C:/Antigravity/strongerN/src/screens/MeasureScreen.tsx))
- **History Log Swipe-to-Delete**:
  - **Trigger**: Dragging a metric history row.
  - **Type**: Same spring/timing pattern as `ActiveWorkoutModal` set rows.

### 9. Muscle Heat Map ([MuscleMapScreen.tsx](file:///C:/Antigravity/strongerN/src/screens/MuscleMapScreen.tsx))
- **Map Focal Zoom (Scale + Translation)**:
  - **Trigger**: Tapping a muscle region on the SVG map.
  - **Type**: Spring scale and coordinate translation.
  - **Default Springs**: `stiffness: 140`, `damping: 16`.
  - **Behavior at 0x**: Focuses instantly on the chosen muscle without transition.
- **Bottom Sheet Snap Slide**:
  - **Trigger**: Opening the metric stats drawer or swiping to expand/collapse.
  - **Type**: Spring translation.
  - **Default Springs**: `stiffness: 140`, `damping: 16` (slide closed: `250ms` timing).
  - **Behavior at 0x**: Drawer opens/snaps to expanded or collapsed states instantly.

### 10. Wearable Companion Simulator ([WatchCompanionSimulator.tsx](file:///C:/Antigravity/strongerN/src/components/ui/WatchCompanionSimulator.tsx))
- **Heartbeat Pulsing Heart Icon**:
  - **Trigger**: Simulated heartbeat tick (every 1.2s).
  - **Type**: Sequential timing scale up and down.
  - **Default Duration**: `150ms` per scale phase.
  - **Behavior at 0x**: Heart icon remains static at scale `1`.
