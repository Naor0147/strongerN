// theme.ts — Central Design Token System
export const colors = {
  bg:            '#12181E',
  surface:       '#1C2530',
  border:        '#2A3036',
  textPrimary:   '#F0F0F0',
  textSecondary: '#A0A0A0',
  accent:        '#3498DB',
  highlight:     '#BB86FC',
  iconActive:    '#FFFFFF',
  iconInactive:  '#757575',
  gold:          '#FFD700',
  error:         '#CF6679',
  success:       '#4CAF50',
};

export const font = {
  family: 'Inter',
  sizes: {
    xs:  11,
    sm:  13,
    md:  15,
    lg:  18,
    xl:  24,
    xxl: 32,
  },
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

export const radius = {
  sm:   8,
  md:   14,
  lg:   20,
  full: 9999,
};

export const shadow = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius:  8,
    elevation:     6,
  },
};
