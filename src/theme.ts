// theme.ts — Central Design Token System (Premium Dark / AMOLED-first)
import { Platform, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────────────────
// STYLESHEET INTERCEPTION & DYNAMIC THEMES
// ─────────────────────────────────────────────────────────────────
const originalCreate = StyleSheet.create;
const registeredStyleSheets: Array<{ original: any; result: any }> = [];
const hexToKeyMap: Record<string, string> = {};

// Intercept StyleSheet.create to record all generated styles
StyleSheet.create = (styles: any) => {
  const result = originalCreate(styles);
  try {
    const originalClone = JSON.parse(JSON.stringify(styles));
    registeredStyleSheets.push({ original: originalClone, result });
  } catch (e) {
    registeredStyleSheets.push({ original: { ...styles }, result });
  }
  return result;
};

// Helper to darken a hex color (percent between 0 and 1)
export function darkenColor(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '');
  let r = parseInt(cleanHex.substring(0, 2), 16);
  let g = parseInt(cleanHex.substring(2, 4), 16);
  let b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return hex;
  }

  r = Math.max(0, Math.floor(r * (1 - percent)));
  g = Math.max(0, Math.floor(g * (1 - percent)));
  b = Math.max(0, Math.floor(b * (1 - percent)));

  const rStr = r.toString(16).padStart(2, '0');
  const gStr = g.toString(16).padStart(2, '0');
  const bStr = b.toString(16).padStart(2, '0');

  return `#${rStr}${gStr}${bStr}`;
}

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

  // Electric Violet (PRs and Milestones) - Replaced with Sky Blue to remove purple
  violet:         '#38BDF8',
  violetGlow:     '#38BDF820',

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

// Flatten current colors to build initial hex-to-token map
const buildHexMap = (obj: any, prefix = '') => {
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string' && val.startsWith('#')) {
      hexToKeyMap[val.toLowerCase()] = path;
    } else if (typeof val === 'object' && val !== null) {
      buildHexMap(val, path);
    }
  }
};
buildHexMap(colors);

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

export const getScaledDuration = (baseDuration: number): number => {
  return baseDuration * globalAnimation.speed;
};

export const getSpringConfig = (baseStiffness = 140, baseDamping = 16, baseMass = 0.9) => {
  const s = globalAnimation.speed;
  if (s <= 0) {
    return {
      stiffness: 99999,
      damping: 999,
      mass: 0.01,
    };
  }
  return {
    stiffness: baseStiffness / (s * s),
    damping: baseDamping / s,
    mass: baseMass,
  };
};

// ─────────────────────────────────────────────────────────────────
// RIPPLE HELPER — Android ripple config factory
// ─────────────────────────────────────────────────────────────────
export const ripple = {
  surface:  { color: '#FFFFFF14', borderless: false },
  accent:   { color: '#4F8EF730', borderless: false },
  borderless: { color: '#FFFFFF20', borderless: true },
};

// ─────────────────────────────────────────────────────────────────
// THEME CONFIGURATION AND EXPORTS
// ─────────────────────────────────────────────────────────────────
export type AppThemeName = 'default' | 'purple' | 'black-white' | 'custom';

export interface ThemeColors {
  accent: string;
  accentDim: string;
  accentGlow: string;
  highlight: string;
  highlightDim: string;
  highlightGlow: string;
  violet: string;
  violetGlow: string;
  gold: string;
  goldGlow: string;
  bg?: string;
  surface?: string;
  surface2?: string;
  surfaceHigh?: string;
  border?: string;
  borderStrong?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
}

export const DEFAULT_THEME: ThemeColors = {
  accent: '#4F8EF7',
  accentDim: '#2B5FC9',
  accentGlow: '#4F8EF720',
  highlight: '#38BDF8',
  highlightDim: '#0284C7',
  highlightGlow: '#38BDF820',
  violet: '#38BDF8',
  violetGlow: '#38BDF820',
  gold: '#6366F1',
  goldGlow: '#6366F120',
  bg: '#0D0F14',
  surface: '#161B24',
  surface2: '#1E2633',
  surfaceHigh: '#242E3E',
  border: '#252D3A',
  borderStrong: '#334155',
  textPrimary: '#EEF1F6',
  textSecondary: '#8B95A5',
  textMuted: '#4E5A6E',
};

export const themePresets: Record<Exclude<AppThemeName, 'custom'>, ThemeColors> = {
  default: { ...DEFAULT_THEME },
  purple: {
    accent: '#7C5CFC',
    accentDim: '#5B3CC7',
    accentGlow: '#7C5CFC20',
    highlight: '#A855F7',
    highlightDim: '#7E22CE',
    highlightGlow: '#A855F720',
    violet: '#C084FC',
    violetGlow: '#C084FC20',
    gold: '#6366F1',
    goldGlow: '#6366F120',
    bg: '#0D0F14',
    surface: '#161B24',
    surface2: '#1E2633',
    surfaceHigh: '#242E3E',
    border: '#252D3A',
    borderStrong: '#334155',
    textPrimary: '#EEF1F6',
    textSecondary: '#8B95A5',
    textMuted: '#4E5A6E',
  },
  'black-white': {
    accent: '#FFFFFF',
    accentDim: '#CCCCCC',
    accentGlow: '#FFFFFF20',
    highlight: '#E2E8F0',
    highlightDim: '#94A3B8',
    highlightGlow: '#E2E8F020',
    violet: '#E2E8F0',
    violetGlow: '#E2E8F020',
    gold: '#CCCCCC',
    goldGlow: '#CCCCCC20',
    bg: '#0D0F14',
    surface: '#161B24',
    surface2: '#1E2633',
    surfaceHigh: '#242E3E',
    border: '#334155',
    borderStrong: '#475569',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
  },
};

export const getCustomThemeColors = (accentColor: string): ThemeColors => {
  const accent = accentColor.startsWith('#') ? accentColor : `#${accentColor}`;
  const accentDim = darkenColor(accent, 0.3);
  const accentGlow = `${accent}20`;
  const highlight = accent;
  const highlightDim = accentDim;
  const highlightGlow = accentGlow;

  return {
    accent,
    accentDim,
    accentGlow,
    highlight,
    highlightDim,
    highlightGlow,
    violet: highlight,
    violetGlow: highlightGlow,
    gold: '#6366F1',
    goldGlow: '#6366F120',
    bg: '#0D0F14',
    surface: '#161B24',
    surface2: '#1E2633',
    surfaceHigh: '#242E3E',
    border: '#252D3A',
    borderStrong: '#334155',
    textPrimary: '#EEF1F6',
    textSecondary: '#8B95A5',
    textMuted: '#4E5A6E',
  };
};

export const updateRegisteredStyles = () => {
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const updateObject = (originalObj: any, resultObj: any) => {
    if (!originalObj || !resultObj) return;
    for (const key of Object.keys(originalObj)) {
      const originalValue = originalObj[key];
      const resultValue = resultObj[key];

      if (typeof originalValue === 'object' && originalValue !== null) {
        updateObject(originalValue, resultValue);
      } else if (typeof originalValue === 'string') {
        const cleanVal = originalValue.toLowerCase().trim();
        const tokenPath = hexToKeyMap[cleanVal];
        if (tokenPath) {
          const newValue = getNestedValue(colors, tokenPath);
          if (newValue) {
            resultObj[key] = newValue;
          }
        }
      }
    }
  };

  for (const sheet of registeredStyleSheets) {
    updateObject(sheet.original, sheet.result);
  }
};

export const applyTheme = (themeName: AppThemeName, customAccent?: string, overrides?: Partial<ThemeColors>) => {
  let selectedThemeColors: ThemeColors;
  if (themeName === 'custom' && customAccent) {
    selectedThemeColors = getCustomThemeColors(customAccent);
  } else {
    selectedThemeColors = { ...(themePresets[themeName as Exclude<AppThemeName, 'custom'>] || themePresets.default) };
  }

  // Merge overrides on top of the selected preset
  if (overrides) {
    selectedThemeColors = {
      ...selectedThemeColors,
      ...overrides,
    };
  }

  // Update colors in-place
  for (const [key, value] of Object.entries(selectedThemeColors)) {
    if (value && typeof value === 'string') {
      (colors as any)[key] = value;
    }
  }

  // Sync muscle group colors to match theme accent
  for (const key of Object.keys(colors.muscle)) {
    if (key !== 'default') {
      (colors.muscle as any)[key] = colors.accent;
    }
  }

  // Update shadow and ripple properties that reference colors
  if (shadow.accentGlow && (shadow.accentGlow as any).ios) {
    (shadow.accentGlow as any).ios.shadowColor = colors.accent;
  }
  if (ripple.accent) {
    ripple.accent.color = `${colors.accent}30`;
  }

  // Re-evaluate all stylesheets
  updateRegisteredStyles();
};
