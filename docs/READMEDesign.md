# 🎨 strongerN Premium Dark AMOLED Design System Prompt

This document defines the central design tokens, visual hierarchy, interaction standards, and component specifications of the **strongerN** design system. Use this document as a system prompt to redesign any application to match the exact visual language, theme, and UX guidelines of strongerN.

---

## 🌌 1. Design Vision & Philosophy

The strongerN design system is engineered for **ambient, high-contrast performance in dark environments**, specifically optimized for mobile applications used during active scenarios (e.g., gym workouts, dark mode interfaces, battery-saving layouts).

### Core Principles
1. **OLED/AMOLED Battery Efficiency:** Backgrounds must be pure deep black (`#0D0F14`). This minimizes battery usage on modern OLED displays by disabling pixels, while reducing ambient glare in low-light environments.
2. **Fatigue-Optimized High-Contrast Readability:** Typography is clean, bold, and geometric, featuring the **Inter** font family scaled to remain legible when the screen is at arm's length or in motion.
3. **Structured Depth Over Solid Boundaries:** Visual blocks are distinguished by layering dark surfaces with calculated elevation shadows and hairlineWidth borders, avoiding light-colored container cards.
4. **Delight in Action (Dynamic Micro-Animations):** Interaction is rewarded with spring-based transitions, numeric count-up animations, and glowing accent highlights.

---

## 🎨 2. Color Tokens & Palette

Always reference color tokens semantically. Never use hardcoded HEX values in layouts.

### Base Colors

| Token Name | HEX Code | Tailwind Equivalent | Semantic Purpose & Usage |
| :--- | :--- | :--- | :--- |
| **`bg`** | `#0D0F14` | `bg-[#0D0F14]` | Screen-level base background. Deep AMOLED black. |
| **`surface`** | `#161B24` | `bg-[#161B24]` | Default card elevation, static lists, tab bars. |
| **`surface2`** | `#1E2633` | `bg-[#1E2633]` | Pressed/hover state overlays, text input backdrops. |
| **`surfaceHigh`** | `#242E3E` | `bg-[#242E3E]` | Floating modals, dropdowns, active item highlights. |
| **`border`** | `#252D3A` | `border-[#252D3A]` | Subtle container borders and divider lines. |
| **`borderStrong`**| `#334155` | `border-[#334155]` | Prominent borders, secondary outlines, active focus borders. |

### Accents & Status Hues

| Token Name | HEX Code | Glow Layer (20% Opacity) | Semantic Purpose & Usage |
| :--- | :--- | :--- | :--- |
| **`accent`** | `#4F8EF7` | `#4F8EF720` | **Electric Blue:** Primary CTAs, active indicators, progress bars. |
| **`accentDim`**| `#2B5FC9` | — | Darker Electric Blue for pressed states of primary buttons. |
| **`highlight`**| `#38BDF8` | `#38BDF820` | **Neon Sky Blue:** Secondary actions, highlighting achievements. |
| **`violet`** | `#7C5CFC` | `#7C5CFC20` | **Electric Violet:** Personal Records (PRs), milestone achievements. |
| **`gold`** | `#6366F1` | `#6366F120` | **Sporty Indigo:** Streaks, trophy awards, milestones. |
| **`success`** | `#22D97A` | `#22D97A20` | **Emerald Green:** Completion states, safe saves, successes. |
| **`error`** | `#F0506E` | — | **Neon Red:** Resets, destructive actions, errors. |

### Typography Colors

| Token Name | HEX Code | Semantic Purpose & Usage |
| :--- | :--- | :--- |
| **`textPrimary`** | `#EEF1F6` | Off-white for high legibility on titles, primary values. |
| **`textSecondary`**| `#8B95A5` | Medium gray for secondary descriptions, labels, units. |
| **`textMuted`** | `#4E5A6E` | Dark gray for timestamps, placeholders, disabled tabs. |
| **`textInverse`** | `#0D0F14` | AMOLED dark text when displayed over light accent fills (e.g., active buttons). |

---

## ✍️ 3. Typography & Hierarchy

The system exclusively utilizes **Inter** (or a similar geometric sans-serif typeface) with varying font weights and tight spacing configurations.

### Font Weights
- **Regular:** `400` (Body copy, comments, metadata descriptions)
- **Medium:** `500` (List values, text fields, subheaders, active metadata)
- **Semibold:** `600` (Segment controls, card headers, secondary titles)
- **Bold:** `700` (Screen headings, callouts, active timers, PR badges)

### Font Size Hierarchy

```
  xs: 11pt  ──► For unit labels (e.g., "kg", "reps", "min"), letter spacing: 0.5px
  sm: 13pt  ──► Body copy, helper comments, sub-labels, primary buttons
  md: 15pt  ──► List titles, inputs, details, text fields
  base: 16pt ─► Main button text, section labels
  lg: 19pt  ──► Card headers, modal headlines
  xl: 24pt  ──► Large quantitative figures, metric cards
  xxl: 30pt ──► Screen titles, primary celebration screens
  hero: 38pt ─► Main countdowns, workout active timers, totals
```

---

## 📐 4. Layout & Spacing System (Strict 4pt Grid)

All paddings, margins, gutters, and layout gaps are aligned on a mathematical **4-point grid** to establish a consistent vertical rhythm.

- **`spacing.xs` (4px):** Micro-gaps between labels and values, icon-to-text offsets.
- **`spacing.sm` (8px):** Row item gaps, inline padding, small item groupings.
- **`spacing.md` (12px):** Default internal padding for small cards, gap inside forms.
- **`spacing.lg` (16px):** Screen-side margins (gutters), default card padding, list spacing.
- **`spacing.xl` (24px):** Margins between content blocks or logical sections.
- **`spacing.xxl` (32px):** Top header margins, screen-level margin buffers.
- **`spacing.xxxl` (48px):** Tall hero areas, workout countdown margins.

---

## 🔲 5. Shapes & Border Radius (`radius`)

Rounding is generous and smooth to provide a premium, modern feel.

- **`radius.xs` (6px):** Inner badges, mini utility pills, small status indicators.
- **`radius.sm` (10px):** Action inputs, buttons, small cards, text field frames.
- **`radius.md` (16px):** Standard containers, main metric cards, modals.
- **`radius.lg` (24px):** Screen headers, overlay backgrounds.
- **`radius.xl` (32px):** Swipe sheets, splash banners.
- **`radius.full` (9999px):** Avatars, circular action triggers, pill shapes.

---

## 🌓 6. Depth, Borders, and Glow Shadows

Avoid using light gray borders. Depth is created by contrasting surfaces (`#161B24` against `#0D0F14`) paired with subtle shadows and ambient colored glow layers.

- **Standard Cards:** Background `#161B24` with a 1px border of `#252D3A`. 
  - *iOS shadow:* `shadowColor: '#000'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.45`, `shadowRadius: 10`.
  - *Android shadow:* `elevation: 8`.
- **Floating Overlays & Modals:** Background `#242E3E` with a 1px border of `#334155`.
  - *iOS shadow:* `shadowColor: '#000'`, `shadowOffset: { width: 0, height: 8 }`, `shadowOpacity: 0.55`, `shadowRadius: 16`.
  - *Android shadow:* `elevation: 14`.
- **Accent Glow Shadow (`shadow.accentGlow`):** Applied to active primary cards/buttons to emit a subtle ambient colored glow.
  - *iOS shadow:* `shadowColor: '#4F8EF7'`, `shadowOffset: { width: 0, height: 0 }`, `shadowOpacity: 0.6`, `shadowRadius: 12`.
  - *Android shadow:* `elevation: 12`.

---

## 🧩 7. Atomic Component Styling Specifications

Use the following guidelines to build the interface controls:

### 1. Primary CTA Buttons
- **Background:** `colors.accent` (`#4F8EF7`)
- **Border Radius:** `radius.md` (`16px`) or `radius.sm` (`10px`) based on size
- **Vertical Padding:** `12px` to `14px`
- **Text Style:** `font.bold` (`Inter_700Bold`), size `sm` (`13px`), color `colors.textInverse` (`#0D0F14`), letter spacing `1px`, capitalized.
- **Shadow:** `shadow.accentGlow` (Electric Blue glow) to give it a high-energy pop.
- **Pressed State:** Background transitions to `colors.accentDim` (`#2B5FC9`), scale scales down slightly to `98%` (0.98), iOS active opacity set to `0.85`.
- **Android Ripple:** Ripple color `#4F8EF730`, `borderless: false`.

### 2. Secondary / Outlined Buttons
- **Background:** `colors.surface2` (`#1E2633`)
- **Border:** `1px` solid `colors.borderStrong` (`#334155`)
- **Border Radius:** `radius.sm` (`10px`) or `radius.xs` (`6px`)
- **Padding:** `6px` vertical, `16px` horizontal (or matching primary button size)
- **Text Style:** `font.bold` (`Inter_700Bold`) or `font.semibold` (`Inter_600SemiBold`), size `11px`, color `colors.textSecondary` (`#8B95A5`).
- **Android Ripple:** Ripple color `#FFFFFF14`, `borderless: false`.

### 3. Text Input Fields
- **Background:** `colors.surface2` (`#1E2633`)
- **Border:** `1px` solid `colors.border` (`#252D3A`)
- **Border Radius:** `radius.sm` (`10px`)
- **Padding:** `12px` to `16px` (`spacing.md`)
- **Text Style:** `font.medium` (`Inter_500Medium`), size `md` (`15px`), color `colors.textPrimary` (`#EEF1F6`).
- **Placeholder Color:** `colors.textMuted` (`#4E5A6E`).
- **Focus State:** Border changes to `colors.accent` (`#4F8EF7`), background changes to `#242E3E` (`colors.surfaceHigh`), and a subtle accent glow shadow is applied.

### 4. Container Cards
- **Background:** `#161B24` (`colors.surface`)
- **Border:** `1px` solid `#252D3A` (`colors.border`)
- **Border Radius:** `radius.md` (`16px`)
- **Default Padding:** `spacing.lg` (`16px`)
- **Shadow:** `shadow.card`
- **Variants:**
  - *Active Variant:* Add solid accent outline (`borderColor: '#4F8EF7'`, `borderWidth: 1.5px`).
  - *PR/Highlight Variant:* Add a left-border bar (`borderLeftWidth: 3px`, `borderLeftColor: '#4F8EF7'`).

---

## 🏃 8. Interactive Micro-Animations & UX Standards (UI/UX Pro Max)

Ensure the following interaction details are strictly met:

1. **State Transition Durations:**
   - **Hover / Press feedback:** `150ms` (Fast).
   - **Scale changes / Switch toggles:** `250ms` (Default).
   - **Swipe sheets / Slow reveals:** `400ms` (Slow).
2. **Spring Damping Physics:** Overlays, slide-out modal cards, and bouncing components must use spring physics with the following attributes to prevent rigid movements:
   - `stiffness: 140`
   - `damping: 16`
   - `mass: 0.9`
3. **No Native Emojis for Icons:** Never use raw system emojis for functional interface elements. Always use modern, lightweight SVGs or vector glyph systems (such as *Lucide* or *Ionicons*) colored semantically.
4. **Touch Target Areas:** Every button, tab, and clickable link must have a minimum touch target area of **44dp x 44dp** to ensure reliable operation while active or in motion.
5. **Physical Haptic Feedback:** Link key UI events to haptic responses (e.g., `expo-haptics` triggers):
   - Button Click / Toggle: `selection` or `light` haptic.
   - Successful save / Workout complete / PR achieved: `success` or `medium` haptic.
   - Resets / Danger actions: `warning` or `heavy` haptic.
6. **Online/Offline Resiliency:** Keep UI audio cues (e.g., rest timers, success chime) local in the package instead of streaming, ensuring offline accessibility.
