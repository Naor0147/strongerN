// src/__tests__/theme.test.ts
import { colors, DEFAULT_THEME, themePresets, applyTheme } from '../theme';

describe('strongerN Theme Engine & Overrides', () => {
  beforeEach(() => {
    // Reapply default theme before each test to clean state
    applyTheme('default');
  });

  test('DEFAULT_THEME is isolated and has pure black #0D0F14 background', () => {
    expect(DEFAULT_THEME.bg).toBe('#0D0F14');
    expect(DEFAULT_THEME.accent).toBe('#4F8EF7');
    expect(DEFAULT_THEME.surface).toBe('#161B24');
  });

  test('applyTheme correctly loads default preset colors', () => {
    applyTheme('default');
    expect(colors.bg).toBe('#0D0F14');
    expect(colors.accent).toBe('#4F8EF7');
    expect(colors.surface).toBe('#161B24');
  });

  test('applyTheme correctly loads other preset colors (e.g. purple)', () => {
    applyTheme('purple');
    expect(colors.bg).toBe('#0D0F14');
    expect(colors.accent).toBe('#7C5CFC'); // Purple accent
  });

  test('applyTheme applies custom overrides on top of presets', () => {
    applyTheme('default', undefined, {
      bg: '#000000', // Override background to pitch black
      surface: '#222222',
      textPrimary: '#FF0000',
    });

    expect(colors.bg).toBe('#000000');
    expect(colors.surface).toBe('#222222');
    expect(colors.textPrimary).toBe('#FF0000');
    // Accent should still be from default preset
    expect(colors.accent).toBe('#4F8EF7');
  });

  test('applyTheme syncs muscle colors with the accent color', () => {
    applyTheme('purple');
    expect(colors.muscle.chest).toBe('#7C5CFC');
    expect(colors.muscle.default).toBe('#3A4454'); // Keep default group color
  });
});
