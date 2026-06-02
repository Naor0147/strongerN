// theme.ts — Central Design Token System (Premium Dark / AMOLED-first)
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────
// COLOR PALETTE — Oppo Find X9 Pro optimised (AMOLED, high-contrast)
// ─────────────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds (deep blacks — battery-efficient on AMOLED)
  bg:             '#0D0F14',
  surface:        '#161B24',
  surface2:       '#1E2633',   // pressed / hover state
  surfaceHigh:    '#242E3E',   // elevated modals / pills

  // Borders
  border:         '#252D3A',
  borderStrong:   '#334155',

  // Primary accent — Electric Blue (CTAs, progress, focus)
  accent:         '#4F8EF7',
  accentDim:      '#2B5FC9',   // darker variant for pressed states
  accentGlow:     '#4F8EF720', // transparent glow (20% opacity)

  // Secondary accent — Neon Sky Blue (replaced Electric Violet with Sky Blue)
  highlight:      '#38BDF8',
  highlightDim:   '#0284C7',
  highlightGlow:  '#38BDF820',

  // Status
  gold:           '#6366F1', // Sporty Indigo Blue (replaced Warm Gold)
  goldGlow:       '#6366F120',
  error:          '#F0506E',
  success:        '#22D97A',
  successGlow:    '#22D97A20',

  // Text
  textPrimary:    '#EEF1F6',
  textSecondary:  '#8B95A5',
  textMuted:      '#4E5A6E',
  textInverse:    '#0D0F14',

  // Icons
  iconActive:     '#EEF1F6',
  iconInactive:   '#4E5A6E',

  // Muscle group color coding (used in Exercises screen)
  muscle: {
    chest:      '#4F8EF7', // Electric Blue (colors.accent)
    back:       '#4F8EF7', // Electric Blue
    shoulders:  '#4F8EF7', // Electric Blue
    biceps:     '#4F8EF7', // Electric Blue
    triceps:    '#4F8EF7', // Electric Blue
    rearDelts:  '#4F8EF7', // Electric Blue
    quads:      '#4F8EF7', // Electric Blue
    hamstrings: '#4F8EF7', // Electric Blue
    glutes:     '#4F8EF7', // Electric Blue
    default:    '#3A4454', // Sleek dark slate
  },
};

// ─────────────────────────────────────────────────────────────────
// TYPOGRAPHY — Inter, scaled for gym readability (large display)
// ─────────────────────────────────────────────────────────────────
export const font = {
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold:     'Inter_700Bold',
  sizes: {
    xs:   11,
    sm:   13,
    md:   15,
    base: 16,
    lg:   19,
    xl:   24,
    xxl:  30,
    hero: 38,
  },
};

// ─────────────────────────────────────────────────────────────────
// SPACING — 4pt grid
// ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  xxxl: 48,
};

// ─────────────────────────────────────────────────────────────────
// BORDER RADIUS — generous, modern, rounded
// ─────────────────────────────────────────────────────────────────
export const radius = {
  xs:   6,
  sm:   10,
  md:   16,
  lg:   24,
  xl:   32,
  full: 9999,
};

// ─────────────────────────────────────────────────────────────────
// SHADOW / ELEVATION — Android: deep + tinted; iOS: shadow props
// ─────────────────────────────────────────────────────────────────
export const shadow = {
  sm: Platform.select({
    android: { elevation: 4 },
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
    default: {},
  }) as object,

  card: Platform.select({
    android: { elevation: 8 },
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10 },
    default: {},
  }) as object,

  lg: Platform.select({
    android: { elevation: 14 },
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 16 },
    default: {},
  }) as object,

  // Accent-colored glow (use as additional StyleSheet layer)
  accentGlow: Platform.select({
    android: { elevation: 12 },
    ios: { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12 },
    default: {},
  }) as object,
};

// ─────────────────────────────────────────────────────────────────
// ANIMATION TOKENS — durations for consistent motion
// ─────────────────────────────────────────────────────────────────
export const animation = {
  fast:     150,
  default:  250,
  slow:     400,
  spring: {
    stiffness: 140,
    damping:   16,
    mass:      0.9,
  },
};

// Mutable global speed factor for dynamic scaling
export const globalAnimation = {
  speed: 1,
};

// ─────────────────────────────────────────────────────────────────
// RIPPLE HELPER — Android ripple config factory
// ─────────────────────────────────────────────────────────────────
export const ripple = {
  surface:  { color: '#FFFFFF14', borderless: false },
  accent:   { color: '#4F8EF730', borderless: false },
  borderless: { color: '#FFFFFF20', borderless: true },
};
