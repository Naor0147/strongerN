import React, { useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import i18n from '../../utils/i18n';
import { styles } from '../../screens/profileStyles';

export interface VolumeSliderProps {
  soundVolume: number;
  setSoundVolume: (val: number) => void;
  soundSetCompleted: string;
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  soundVolume,
  setSoundVolume,
  soundSetCompleted,
}) => {
  const [sliderWidth, setSliderWidth] = useState(200);
  const [localVolume, setLocalVolume] = useState(soundVolume);
  const [prevSoundVolume, setPrevSoundVolume] = useState(soundVolume);

  if (soundVolume !== prevSoundVolume) {
    setLocalVolume(soundVolume);
    setPrevSoundVolume(soundVolume);
  }

  const startVolumeRef = useRef(0);
  const localVolumeRef = useRef(localVolume);
  localVolumeRef.current = localVolume;

  const setSoundVolumeRef = useRef(setSoundVolume);
  setSoundVolumeRef.current = setSoundVolume;

  const soundSetCompletedRef = useRef(soundSetCompleted);
  soundSetCompletedRef.current = soundSetCompleted;

  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onStart((e) => {
      const initialTouchX = e.x;
      const width = sliderWidthRef.current || 200;
      let newVolume = Math.max(0, Math.min(1, initialTouchX / width));
      newVolume = Math.round(newVolume * 20) / 20;
      setLocalVolume(newVolume);
      startVolumeRef.current = newVolume;
    })
    .onUpdate((e) => {
      const width = sliderWidthRef.current || 200;
      const deltaVol = e.translationX / width;
      let newVolume = Math.max(0, Math.min(1, startVolumeRef.current + deltaVol));
      newVolume = Math.round(newVolume * 20) / 20;
      setLocalVolume(newVolume);
    })
    .onEnd(() => {
      const finalVol = localVolumeRef.current;
      if (setSoundVolumeRef.current) {
        setSoundVolumeRef.current(finalVol);
      }
      import('../../utils/soundPlayer').then((m) =>
        m.playSoundByKey(soundSetCompletedRef.current)
      );
    });

  return (
    <View style={styles.volumeSliderContainer}>
      <View style={styles.volumeSliderHeader}>
        <Ionicons name="volume-medium-outline" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
        <Text style={styles.settingTitle}>{i18n.t('profile.soundVolume')}</Text>
        <Text style={styles.volumePercentage}>{Math.round(localVolume * 100)}%</Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <View
          style={styles.volSliderTrack}
          onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        >
        <View style={[styles.volSliderFill, { width: `${localVolume * 100}%`, pointerEvents: 'none' }]} />
        <View style={[styles.volSliderThumb, { left: `${localVolume * 100}%`, pointerEvents: 'none' }]} />
        </View>
      </GestureDetector>
    </View>
  );
};
