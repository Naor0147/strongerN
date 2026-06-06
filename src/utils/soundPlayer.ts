// utils/soundPlayer.ts
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * Web Audio API synthesizer for premium UI chimes without downloading large files.
 */
function playWebSynthesizer(notes: { freq: number; duration: number; delay: number }[]) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    notes.forEach(note => {
      setTimeout(() => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, ctx.currentTime);

          // Fast attack, exponential decay for premium organic bell-like chime
          const peakGain = 0.15 * (soundConfig.volume ?? 1.0);
          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(peakGain, ctx.currentTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          osc.stop(ctx.currentTime + note.duration + 0.05);
        } catch (err) {
          console.warn('[Web Audio Play Note Error]', err);
        }
      }, note.delay * 1000);
    });
  } catch (e) {
    console.warn('[Web Audio Context Error]', e);
  }
}

export const soundConfig = {
  setChecked: 'chime',       // string
  timerCompleted: 'beep',     // string
  workoutCompleted: 'fanfare', // string
  volume: 0.8,               // 0.0 to 1.0
  customSounds: [] as { id: string; name: string; uri: string }[],
};

/**
 * Web Audio API helper for specific sound keys on Web
 */
function playWebSound(soundKey: string) {
  if (soundKey === 'chime') {
    playWebSynthesizer([
      { freq: 523.25, duration: 0.15, delay: 0 },
      { freq: 659.25, duration: 0.25, delay: 0.06 },
    ]);
  } else if (soundKey === 'beep') {
    playWebSynthesizer([
      { freq: 880.00, duration: 0.15, delay: 0 },
      { freq: 880.00, duration: 0.30, delay: 0.20 },
    ]);
  } else if (soundKey === 'fanfare') {
    playWebSynthesizer([
      { freq: 523.25, duration: 0.2, delay: 0 },
      { freq: 659.25, duration: 0.2, delay: 0.08 },
      { freq: 783.99, duration: 0.2, delay: 0.16 },
      { freq: 1046.50, duration: 0.4, delay: 0.24 },
    ]);
  } else {
    // Check for custom sound
    const custom = soundConfig.customSounds.find(s => s.id === soundKey);
    if (custom) {
      try {
        const audio = new Audio(custom.uri);
        audio.volume = soundConfig.volume ?? 1.0;
        audio.play().catch(err => console.warn('[Web Custom Audio Play Error]', err));
      } catch (err) {
        console.warn('[Web Custom Audio Init Error]', err);
      }
    }
  }
}

/**
 * Native audio player using expo-audio. 
 * Loads locally-bundled synthesized sound files for offline reliability.
 */
async function playNativeSound(soundKey: string) {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
    });

    let player;
    if (soundKey === 'chime') {
      player = createAudioPlayer(require('../../assets/sounds/set_completed.wav'));
    } else if (soundKey === 'beep') {
      player = createAudioPlayer(require('../../assets/sounds/timer_completed.wav'));
    } else if (soundKey === 'fanfare') {
      player = createAudioPlayer(require('../../assets/sounds/workout_completed.wav'));
    } else {
      // Check for custom sound
      const custom = soundConfig.customSounds.find(s => s.id === soundKey);
      if (custom) {
        player = createAudioPlayer({ uri: custom.uri });
      } else {
        return;
      }
    }

    if (player) {
      player.volume = soundConfig.volume ?? 1.0;
      player.play();

      const listener = player.addListener('playbackStatusUpdate', (status) => {
        if (status.playbackState === 'ended') {
          player.release();
          listener.remove();
        }
      });
    }
  } catch (err) {
    console.log(`[Native Sound Error] Play ${soundKey} audio chimes:`, err);
  }
}

/**
 * Plays sound configured for checking off a set.
 */
export function playSetCheckedSound() {
  const choice = soundConfig.setChecked;
  if (choice === 'mute') return;
  if (isWeb) {
    playWebSound(choice);
  } else {
    playNativeSound(choice);
  }
}

/**
 * Plays sound configured for rest timer completion.
 */
export function playTimerCompletedSound() {
  const choice = soundConfig.timerCompleted;
  if (choice === 'mute') return;
  if (isWeb) {
    playWebSound(choice);
  } else {
    playNativeSound(choice);
  }
}

/**
 * Plays sound configured for finishing a workout.
 */
export function playWorkoutCompletedSound() {
  const choice = soundConfig.workoutCompleted;
  if (choice === 'mute') return;
  if (isWeb) {
    playWebSound(choice);
  } else {
    playNativeSound(choice);
  }
}

/**
 * Plays any sound by its key (e.g. for preview / testing).
 */
export function playSoundByKey(soundKey: string) {
  if (soundKey === 'mute') return;
  if (isWeb) {
    playWebSound(soundKey);
  } else {
    playNativeSound(soundKey);
  }
}
