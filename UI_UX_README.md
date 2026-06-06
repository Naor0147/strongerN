# 🎨 UI/UX Design System & Profile — strongerN

Welcome to the premium design and user experience documentation for **strongerN**. This guide represents the "Design Brain" of our high-fidelity, high-contrast, **AMOLED-first** fitness tracking application, enriched with **UI/UX Pro Max** design intelligence.

---

## 🌌 1. Design Vision & Philosophy

`strongerN` is crafted to be a top-tier mobile gym companion. The user interface is driven by a singular aesthetic philosophy: **ambient, high-contrast performance in dark environments.**

```
   ┌──────────────────────────────────────────────────────────┐
   │                     AMOLED BLACK (#0D0F14)               │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │   ⚡ ELECTRIC BLUE (#4F8EF7)                         │  │
   │  │   Primary CTAs, Active States & Progress Tracking  │  │
   │  └────────────────────────────────────────────────────┘  │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │   🔮 ELECTRIC VIOLET (#7C5CFC)                       │  │
   │  │   Personal Records, Badges, Milestones & Trophies  │  │
   │  └────────────────────────────────────────────────────┘  │
   │                                                          │
   │       🔋 AMOLED Power-Saving (OLED Black Layouts)        │
   │       ⚡ Micro-Animations & Tactile Spring Feedback      │
   └──────────────────────────────────────────────────────────┘
```

### Core Design Principles:
1. **OLED Battery Efficiency:** Near-pure black base backgrounds (`#0D0F14`) minimize screen illumination and battery usage on OLED/AMOLED displays—critical for long workouts with screens left on.
2. **Fatigue-Optimized Readability:** High-contrast typography featuring the **Inter** font family scaled specifically for gym-goers who need to read metrics clearly while lifting weights or performing intense cardio.
3. **Elevated Visual Hierarchy:** Cards and layouts utilize layered depth elevations (from `#161B24` to `#242E3E`) outlined with elegant hairlineWidth borders to prevent visual clutter while structuring key statistics.
4. **Delight in Action:** Dynamic micro-animations (such as counting up statistics and smooth spring transitions) create micro-moments of delight that gamify and reward progressive overload.

---

## 🎨 2. The Color System (`theme.ts`)

Our color scheme balances ultimate battery efficiency with high-energy accents. Every hue is meticulously mapped in `theme.ts` and must be referenced semantically.

> [!TIP]
> Never use hardcoded hex values in screens. Always reference the semantic tokens from the imported `colors` system to ensure visual consistency.

### Primary Design System Colors

| Token | Hex Value | Visual Swatch | Semantic Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **`bg`** | `#0D0F14` | `⬛` (AMOLED Dark) | Screen-level base background. Deep black. |
| **`surface`** | `#161B24` | `⬜` (Dark Slate) | Default elevation layer (Cards, static lists, tab bars). |
| **`surface2`** | `#1E2633` | `⬜` (Slate Gray) | Hover, pressed states, or active item highlights. |
| **`surfaceHigh`** | `#242E3E` | `⬜` (Light Slate) | Floating modals, elevated dropdowns, or key pill containers. |
| **`accent`** | `#4F8EF7` | `🟦` (Electric Blue) | Core CTAs, active indicators, progress bars, highlights. |
| **`highlight`** | `#38BDF8` | `🟦` (Neon Sky Blue) | Replaced Electric Violet. Personal Records (PRs), achievements. |
| **`violet`** | `#7C5CFC` | `🟪` (Electric Violet) | Achievements, PR markers, special highlights. |
| **`gold`** | `#6366F1` | `🟪` (Sporty Indigo) | Replaced Warm Gold. Streaks, trophy awards, milestones. |
| **`success`** | `#22D97A` | `🟩` (Emerald Green) | Safe completion states, successfully saved indicators. |
| **`error`** | `#F0506E` | `🟥` (Neon Red) | Deletion states, critical errors, resets, danger actions. |

### Muscle-Group Code Matrix
To facilitate rapid visual scanning during workouts, muscle groups are systematically color-coded:

```json
{
  "Chest":      "#4F8EF7", // Electric Blue (Primary focus)
  "Back":       "#4F8EF7",
  "Shoulders":  "#4F8EF7",
  "Biceps":     "#4F8EF7",
  "Triceps":    "#4F8EF7",
  "Legs":       "#4F8EF7",
  "Default":    "#3A4454"  // Sleek Dark Slate
}
```

---

## ✍️ 3. Typography & Spacing Grid

### Typography System
We use the modern, highly geometric **Inter** typeface (loaded dynamically via Expo Fonts), engineered for maximum legibility in variable screen sizes and sizes:

*   **`font.regular`** (`Inter_400Regular`): Body copy, labels, helper text, comments.
*   **`font.medium`** (`Inter_500Medium`): Secondary buttons, list values, subheaders.
*   **`font.semibold`** (`Inter_600SemiBold`): Secondary titles, segment controls, Card labels.
*   **`font.bold`** (`Inter_700Bold`): Hero counts, workout headers, PR trophies.

#### Font Size Hierarchy (in pt)
```text
  xs: 11pt  ──► For unit labels (e.g., "kg", "reps", "min")
  sm: 13pt  ──► For body text, comments, and secondary information
  md: 15pt  ──► Default input size, list titles, row item descriptors
  base: 16pt ─► Main button text, section labels
  lg: 19pt  ──► Card headers, modal headlines
  xl: 24pt  ──► Big stat numbers (StatCard.tsx values)
  xxl: 30pt ──► Screen titles, congratulations highlights
  hero: 38pt ─► Main active timers, total weight workout volume counters
```

### Spacing System (4pt Grid)
All paddings, margins, and layout gaps follow a strict 4-point spacing grid. This guarantees a mathematically perfect rhythm across screens:

| Token | Size (pt) | Direct UI Usage |
| :--- | :--- | :--- |
| **`spacing.xs`** | `4` | Ultra-tight margins, label to value offsets. |
| **`spacing.sm`** | `8` | Icon-to-text gaps, dense row items, inline padding. |
| **`spacing.md`** | `12` | Default component-level spacing, sub-card paddings. |
| **`spacing.lg`** | `16` | Screen-side gutters, default card padding, lists. |
| **`spacing.xl`** | `24` | Large spacing between content groups or blocks. |
| **`spacing.xxl`** | `32` | Header-to-content buffers, screen margins. |
| **`spacing.xxxl`**| `48` | Main active timer margin, hero height padding. |

---

## 🔲 4. Layering, Borders & Shadow Depths

To separate visual blocks without using heavy light-colored lines, the design system utilizes modular elevations:

*   **Border Radius (`radius`)**: Generous premium rounding creates a modern, sleek mobile look:
    *   `radius.xs: 6` (Inner badges, mini-pills)
    *   `radius.sm: 10` (Action inputs, icon wrappers, tight buttons)
    *   `radius.md: 16` (Main container cards, stat blocks)
    *   `radius.lg: 24` (Screen headers, modal overlays)
    *   `radius.xl: 32` (Bottom Sheet actions, top splash banners)
    *   `radius.full: 9999` (Circular avatars, circular icon button toggles)

*   **Shadow / Elevation (`shadow`)**: Customized for platform-specific rendering to ensure beautiful visual layers:
    *   **Android:** Uses precise `elevation` offsets (ranging from `4` for tags, `8` for default cards, to `14` for overlay sheets).
    *   **iOS:** Shadow layers are defined with `shadowOpacity: 0.45` to `0.55` and a deep dark `shadowColor` to simulate organic depth.
    *   **`shadow.accentGlow`:** A special glowing layer combining `#4F8EF7` blue shadows with a `12px` radius on iOS, creating a gorgeous light-emission effect behind active cards.

---

## 🧩 5. Atomic UI Component Registry

The `components/` directory holds modular blocks developed to enforce reusable styles.

```
       [ App.tsx / Screens ]
                 │
       ┌─────────┴─────────┐
 ┌─────▼─────┐       ┌─────▼─────┐
 │  Layouts  │       │ Atomic UI │
 └─────┬─────┘       └─────┬─────┘
       ├── ActiveWorkoutBar│├── Card
       ├── BottomTabBar    │├── StatCard
       └── ScreenHeader    │├── Badge
                           │└── ...
```

### Key UI Primitives:
1.  **[Card.tsx](file:///C:/Antigravity/strongerN/components/ui/Card.tsx):** Standard card wrapper using elevation `shadow.card`. Available in `active` variant (adds full blue accent border) and `accent` variant (adds custom left accent line).
2.  **[StatCard.tsx](file:///C:/Antigravity/strongerN/components/ui/StatCard.tsx):** Premium quantitative display. Incorporates dynamic haptic-feeling **Animated count-ups** for numbers, and a translucent icon wrapper (`colors.accent + '20'`) to create ambient color zones.
3.  **[BarChart.tsx](file:///C:/Antigravity/strongerN/components/ui/BarChart.tsx):** A custom SVG layout compiling weekly activities. Renders beautiful vertical columns, customizable highlight states, and animated height rendering.
4.  **[Badge.tsx](file:///C:/Antigravity/strongerN/components/ui/Badge.tsx):** Renders status pills (e.g. "PR Achieved" or "PRO User") with custom colored backgrounds and high contrast text ratios.
5.  **[PressableRow.tsx](file:///C:/Antigravity/strongerN/components/ui/PressableRow.tsx):** Multi-purpose interactive list items with tailored Android feedback ripples (`ripple.surface`) and iOS opacity scaling.

---

## 🏃 6. Interactive Micro-Animations & UX Details

`strongerN` goes beyond static design to deliver an interactive experience:

*   **Spring-Modals:** Modals use standard reanimated-like spring damping mechanics (`stiffness: 140, damping: 16`) for bouncing and sliding overlays, reducing UI rigidness.
*   **Sticky Interactive Session Widget ([ActiveWorkoutBar.tsx](file:///C:/Antigravity/strongerN/components/layout/ActiveWorkoutBar.tsx)):** Floating above the tab bar, this animated component provides direct access to the live session in progress. Includes a pulsating live icon and counting elapsed time.
*   **Android Tap Ripple Effects:** Configured individually using our ripple factories in `theme.ts` to matches container shapes, keeping boundaries clean and natural.

---

## 📋 7. UI/UX Pro Max Quality Checklist

Every new component and screen added to `strongerN` must pass this UI/UX review before merging:

- [ ] **No Raw Colors:** All color assignments must draw from `./theme` (`colors.bg`, `colors.surface`, etc.).
- [ ] **AMOLED Compatibility:** Screen backdrops must be `#0D0F14` (`colors.bg`). Avoid large `#FFFFFF` panels that ruin night-vision and drain battery.
- [ ] **Contrast Verification:** Ensure all small texts maintain at least a **4.5:1** contrast ratio against backgrounds. Use `colors.textSecondary` (`#8B95A5`) or `colors.textPrimary` (`#EEF1F6`) for overlays.
- [ ] **No Emoji Icons:** Icons must utilize native SVGs or unified vector families (such as `@expo/vector-icons` Ionicons/Lucide). Never use native emojis as functional icons.
- [ ] **Haptic Expectation:** All primary clicks, toggles, and completed actions should be coupled with haptic feedback prompts (`expo-haptics`).
- [ ] **Touch Target Size:** Interactive elements must have a minimum touch target area of **44dp x 44dp** to ensure easy activation while lifting weights.
- [ ] **Safe-Area Padding:** Utilize standard headers and safe-area wrappers to avoid clipping behind phone cameras, notches, or home bars.
- [ ] **Smooth Transitions:** State changes, toggles, or screen changes must use standard durations (`150ms` for hover, `250ms` for scale/switches).
- [ ] **Offline Sound Resiliency:** Ensure all notification/UI audio assets are bundled locally in `assets/sounds/` and triggered offline (no HTTP streaming).
- [ ] **Redirect Link Verification:** Google Authentication must support deep link callback events (`strongern://oauth-callback`) alongside standard web popups.
- [ ] **Simulated Sandbox Labels:** Any non-native UI representation of system-level services (like HealthKit and smartwatch watch faces) must be clearly labeled as `(Simulated)`.

---

> Created and maintained with **UI/UX Pro Max** intelligence. Keep this file updated during feature expansions to maintain design continuity across our entire ecosystem. To update the AST knowledge graph of these designs, run `graphify update .`.
