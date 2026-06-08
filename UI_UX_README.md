# 🎨 UI/UX Design System & Profile — strongerN

A concise reference for the **AMOLED-first** high-fidelity design system in `strongerN`.

---

## 🌌 1. Design Philosophy
- **AMOLED-first**: Deep black background (`#0D0F14`) for battery efficiency and gym environments.
- **High Contrast**: Clean typography using **Inter** font family for legibility while training.
- **Layered Depth**: Card elevations utilizing thin, elegant borders rather than heavy colors.
- **Micro-Interactions**: Spring animations and haptic feedback to reward user progression.

---

## 🎨 2. Theme Colors (`theme.ts`)

| Token | Hex Value | Purpose |
| :--- | :--- | :--- |
| **`bg`** | `#0D0F14` | Base black background. |
| **`surface`** | `#161B24` | Default container background (Cards, list rows, tab bar). |
| **`surface2`** | `#1E2633` | Active highlights / Pressed states. |
| **`surfaceHigh`** | `#242E3E` | Elevated elements (Modals, dropdowns). |
| **`accent`** | `#4F8EF7` | Electric Blue. Primary CTAs, active selectors. |
| **`highlight`** | `#38BDF8` | Neon Sky Blue. Personal Records (PRs), achievements. |
| **`violet`** | `#7C5CFC` | Electric Violet. Milestone tags. |
| **`gold`** | `#6366F1` | Sporty Indigo. Streaks, trophy elements. |
| **`success`** | `#22D97A` | Emerald Green. Completion/saved states. |
| **`error`** | `#F0506E` | Neon Red. Reset/destructive actions. |

**Muscle Colors**: Focus groups use `colors.accent` (`#4F8EF7`), inactive default is `#3A4454`.

---

## ✍️ 3. Typography & Spacing Grid

### Typography (Inter Font)
*   **`font.regular`** (400) | **`font.medium`** (500) | **`font.semibold`** (600) | **`font.bold`** (700)
*   **Sizes (pt)**:
    `xs`: 11 (units) | `sm`: 13 (body/desc) | `md`: 15 (inputs/rows) | `base`: 16 (buttons/labels)
    `lg`: 19 (card headers) | `xl`: 24 (large stats) | `xxl`: 30 (titles) | `hero`: 38 (active timers)

### Spacing (4px Grid)
`xs`: 4 | `sm`: 8 | `md`: 12 | `lg`: 16 | `xl`: 24 | `xxl`: 32 | `xxxl`: 48

---

## 🔲 4. Radius & Shadows
- **Borders (`radius`)**:
  `xs`: 6 | `sm`: 10 (buttons/inputs) | `md`: 16 (cards) | `lg`: 24 (modals) | `xl`: 32 | `full`: 9999 (avatars)
- **Shadows (`shadow`)**:
  - Android: `elevation` 4 to 14.
  - iOS: `shadowOpacity` 0.45 to 0.55 with black color.
  - **`shadow.accentGlow`**: Special Electric Blue shadow glow (12px radius).

---

## 🧩 5. Atomic Components
All primitives reside in [components/ui/](file:///C:/Antigravity/strongerN/components/ui/):
- **[Card](file:///C:/Antigravity/strongerN/components/ui/Card.tsx)**: Rounded card wrapper with `shadow.card`. Support active outline & left-accent variants.
- **[StatCard](file:///C:/Antigravity/strongerN/components/ui/StatCard.tsx)**: Displays metrics using dynamic counting animations.
- **[BarChart](file:///C:/Antigravity/strongerN/components/ui/BarChart.tsx)**: Weekly activity SVG bar representation.
- **[Badge](file:///C:/Antigravity/strongerN/components/ui/Badge.tsx)**: Status indicators (PR/Pro) with high-contrast background.
- **[PressableRow](file:///C:/Antigravity/strongerN/components/ui/PressableRow.tsx)**: Row component with built-in platform ripples and active state scale.

---

## 🏃 6. UX Animations & Ripples
- **Modals**: Smooth spring curves (`stiffness: 140, damping: 16`).
- **Live Tracking**: Floating active workout bar ([ActiveWorkoutBar.tsx](file:///C:/Antigravity/strongerN/components/layout/ActiveWorkoutBar.tsx)) with pulsating indicator.
- **Android Ripples**: Custom surface-shaped ripples defined in `theme.ts`.

---

## 📋 7. UI/UX Pro Max Quality Checklist

Every screen/component must satisfy these requirements:

- [ ] **Token Only Colors**: No hardcoded hex values. Reference `colors` from `./theme`.
- [ ] **AMOLED-First**: Base background must be `#0D0F14` (`colors.bg`). Avoid large bright blocks.
- [ ] **4.5:1 Contrast**: All text must meet legibility ratios against background.
- [ ] **No Native Emojis**: Use SVG icons (e.g., Lucide, Ionicons) for UI actions.
- [ ] **Tactile Haptics**: Wire key actions (button clicks, completions) to `expo-haptics`.
- [ ] **Workout-Safe Targets**: Minimum touch targets of **44dp x 44dp**.
- [ ] **Safe-Area Wrappers**: Prevent clipping behind camera notches/home bar.
- [ ] **Transitions**: Interactive state transitions must be between `150ms` and `250ms`.
- [ ] **Offline Resilience**: Sounds and icons must be local. Avoid external assets/streams.
- [ ] **Auth Deep Links**: Authentication redirects must handle deep links (`strongern://oauth-callback`).
- [ ] **Simulated Badges**: Flag simulated/non-native layers clearly as `(Simulated)`.
