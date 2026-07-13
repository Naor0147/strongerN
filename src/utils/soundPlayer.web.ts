// utils/soundPlayer.web.ts
import { Platform } from 'react-native';

const isWeb = true;

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
  setChecked: 'satisfying-click',       // string
  timerCompleted: 'beep',     // string
  workoutCompleted: 'fanfare', // string
  volume: 0.8,               // 0.0 to 1.0
  customSounds: [] as { id: string; name: string; uri: string }[],
};

const webPlayersCache: Record<string, HTMLAudioElement> = {};

const WEB_SOUND_ASSETS: Record<string, any> = {
  'bell1': require('../../assets/sounds/bell1.mp3'),
  'bell2': require('../../assets/sounds/bell2.mp3'),
  'boxing-bell': require('../../assets/sounds/boxing-bell.mp3'),
  'satisfying-click': require('../../sound/00_satisfying_click_v3.wav'),
  'uncheck-click': require('../../sound/06_click_warm.wav'),
  'satisfying-click-finish': require('../../sound/00_satisfying_click_v3.wav'),
  'satisfying-click-timer': require('../../sound/satisfyingClick.wav'),
};

function getOrCreateWebPlayer(soundKey: string, source: any): HTMLAudioElement | null {
  if (!webPlayersCache[soundKey]) {
    try {
      webPlayersCache[soundKey] = new Audio(source);
    } catch (e) {
      console.warn(`[Web Audio Error] Failed to create player for ${soundKey}:`, e);
      return null;
    }
  }
  return webPlayersCache[soundKey];
}

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
    let audio: HTMLAudioElement | null = null;
    if (WEB_SOUND_ASSETS[soundKey]) {
      audio = getOrCreateWebPlayer(soundKey, WEB_SOUND_ASSETS[soundKey]);
    } else {
      // Check for custom sound
      const custom = soundConfig.customSounds.find(s => s.id === soundKey);
      if (custom) {
        audio = getOrCreateWebPlayer(custom.uri, custom.uri);
      }
    }

    if (audio) {
      try {
        audio.volume = soundConfig.volume ?? 1.0;
        audio.currentTime = 0;
        audio.play().catch(err => console.warn(`[Web Audio Play Error] ${soundKey}:`, err));
      } catch (err) {
        console.warn(`[Web Audio Run Error] ${soundKey}:`, err);
      }
    }
  }
}

/**
 * Plays sound configured for checking off a set.
 */
export function playSetCheckedSound() {
  const choice = soundConfig.setChecked;
  if (choice === 'mute') return;
  playWebSound(choice);
}

/**
 * Plays sound configured for rest timer completion.
 */
export function playTimerCompletedSound() {
  const choice = soundConfig.timerCompleted;
  if (choice === 'mute') return;
  playWebSound(choice);
}

/**
 * Plays sound configured for finishing a workout.
 */
export function playWorkoutCompletedSound() {
  const choice = soundConfig.workoutCompleted;
  if (choice === 'mute') return;
  playWebSound(choice);
}

/**
 * Plays any sound by its key (e.g. for preview / testing).
 */
export function playSoundByKey(soundKey: string) {
  if (soundKey === 'mute') return;
  playWebSound(soundKey);
}

/**
 * Plays sound configured for unchecking a set.
 */
export function playUncheckSetSound() {
  playWebSound('uncheck-click');
}

/**
 * Plays satisfying click sound when finishing a set.
 */
export function playSatisfyingClickFinishSet() {
  playWebSound('satisfying-click-finish');
}

/**
 * Plays satisfying click sound when stopping the timer.
 */
export function playSatisfyingClickStopTimer() {
  playWebSound('satisfying-click-timer');
}

/**
 * Initialize sounds (no-op on web)
 */
export async function initSounds() {
  // No-op on web
}

