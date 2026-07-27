import React, { useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import i18n from '../../utils/i18n';
import { styles } from '../../screens/profileStyles';

export interface AnimationSpeedSliderProps {
  animationSpeed: number;
  setAnimationSpeed: (val: number) => void;
}

export const AnimationSpeedSlider: React.FC<AnimationSpeedSliderProps> = ({
  animationSpeed,
  setAnimationSpeed,
}) => {
  const [sliderWidth, setSliderWidth] = useState(200);
  const [localSpeed, setLocalSpeed] = useState(animationSpeed);
  const [prevAnimationSpeed, setPrevAnimationSpeed] = useState(animationSpeed);

  if (animationSpeed !== prevAnimationSpeed) {
    setLocalSpeed(animationSpeed);
    setPrevAnimationSpeed(animationSpeed);
  }

  const startSpeedRef = useRef(0);
  const localSpeedRef = useRef(localSpeed);
  localSpeedRef.current = localSpeed;

  const setAnimationSpeedRef = useRef(setAnimationSpeed);
  setAnimationSpeedRef.current = setAnimationSpeed;

  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;

  const animPanGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onStart((e) => {
      const initialTouchX = e.x;
      const width = sliderWidthRef.current || 200;
      let newSpeed = Math.max(0, Math.min(2, (initialTouchX / width) * 2));
      newSpeed = Math.round(newSpeed * 20) / 20;
      setLocalSpeed(newSpeed);
      startSpeedRef.current = newSpeed;
    })
    .onUpdate((e) => {
      const width = sliderWidthRef.current || 200;
      const deltaSpeed = (e.translationX / width) * 2;
      let newSpeed = Math.max(0, Math.min(2, startSpeedRef.current + deltaSpeed));
      newSpeed = Math.round(newSpeed * 20) / 20;
      setLocalSpeed(newSpeed);
    })
    .onEnd(() => {
      const finalSpeed = localSpeedRef.current;
      if (setAnimationSpeedRef.current) {
        setAnimationSpeedRef.current(finalSpeed);
      }
    });

  return (
    <View style={styles.volumeSliderContainer}>
      <View style={styles.volumeSliderHeader}>
        <Ionicons name="speedometer-outline" size={20} color={colors.highlight} style={{ marginRight: spacing.sm }} />
        <Text style={styles.settingTitle}>{i18n.t('profile.globalAnimSpeed')}</Text>
        <Text style={styles.volumePercentage}>
          {localSpeed === 0 ? i18n.t('profile.instantAnim') : `${localSpeed}x`}
        </Text>
      </View>
      <GestureDetector gesture={animPanGesture}>
        <View
          style={styles.volSliderTrack}
          onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        >
          <View style={[styles.volSliderFill, { width: `${(localSpeed / 2) * 100}%`, pointerEvents: 'none' }]} />
          <View style={[styles.volSliderThumb, { left: `${(localSpeed / 2) * 100}%`, pointerEvents: 'none' }]} />
        </View>
      </GestureDetector>
    </View>
  );
};
