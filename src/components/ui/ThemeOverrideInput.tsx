import React, { useState, useEffect } from 'react';
import { View, TextInput } from 'react-native';
import { colors, spacing } from '../../theme';
import i18n from '../../utils/i18n';
import { styles } from '../../screens/profileStyles';

export interface ThemeOverrideInputProps {
  overrideKey: string;
  defaultVal: string;
  themeOverrides: any;
  onUpdateThemeOverrides?: (overrides: any) => void;
}

export const ThemeOverrideInput: React.FC<ThemeOverrideInputProps> = ({
  overrideKey,
  defaultVal,
  themeOverrides,
  onUpdateThemeOverrides,
}) => {
  const currentVal = (themeOverrides && themeOverrides[overrideKey]) || '';
  const [text, setText] = useState(currentVal);

  useEffect(() => {
    setText(currentVal);
  }, [currentVal]);

  const handleChangeText = (val: string) => {
    let cleanHex = val.replace(/[^#0-9A-Fa-f]/g, '');
    if (cleanHex.length > 0 && !cleanHex.startsWith('#')) {
      cleanHex = '#' + cleanHex;
    }
    setText(cleanHex);

    if (cleanHex === '') {
      if (onUpdateThemeOverrides) {
        onUpdateThemeOverrides({ [overrideKey]: undefined });
      }
    } else if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cleanHex)) {
      if (onUpdateThemeOverrides) {
        onUpdateThemeOverrides({ [overrideKey]: cleanHex });
      }
    }
  };

  const handleBlur = () => {
    if (text !== '' && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text)) {
      setText(currentVal);
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <TextInput
        style={styles.hexInputSmall}
        placeholder={i18n.t('profile.hexCodePlaceholder', { code: defaultVal })}
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        maxLength={7}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text) ? text : defaultVal,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      />
    </View>
  );
};
