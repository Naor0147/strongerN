// components/ui/Avatar.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, font, radius } from '../../theme';

interface AvatarProps {
  uri?:      string;
  initials?: string;
  size?:     number;
  isPro?:    boolean;
  style?:    StyleProp<ViewStyle>;
  testID?:   string;
}

const Avatar: React.FC<AvatarProps> = ({
  uri,
  initials = '?',
  size = 52,
  isPro = false,
  style,
  testID,
}) => {
  const ringWidth = 1.5;
  const ringColor = colors.border;
  const ringSize  = size + ringWidth * 4;

  return (
    <View
      style={[
        styles.ring,
        {
          width:        ringSize,
          height:       ringSize,
          borderRadius: ringSize / 2,
          borderWidth:  ringWidth,
          borderColor:  ringColor,
        },
        style,
      ]}
      testID={testID}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width:            size,
              height:           size,
              borderRadius:     size / 2,
              backgroundColor:  colors.accentDim,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    alignItems:      'center',
    justifyContent:  'center',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems:      'center',
    justifyContent:  'center',
  },
  initials: {
    color:      colors.textPrimary,
    fontFamily: font.bold,
  },
});

export default Avatar;
