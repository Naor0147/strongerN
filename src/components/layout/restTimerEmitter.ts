import { AppState } from 'react-native';
import { scheduleRestTimerNotification, cancelRestTimerNotification } from '../../utils/notifications';
import { playTimerCompletedSound, playSatisfyingClickStopTimer } from '../../utils/soundPlayer';

export class RestTimerEmitter {
  private listeners = new Set<(state: { remaining: number; active: boolean; endTarget?: number | null }) => void>();
  private remaining = 0;
  private active = false;
  private intervalId: any = null;
  private endTarget: number | null = null;
  private isDragging = false;

  constructor() {
    if (AppState && typeof AppState.addEventListener === 'function') {
      try {
        AppState.addEventListener('change', (nextState) => {
          if (nextState === 'active') {
            this.sync();
          }
        });
      } catch (e) {
        console.warn('[AppState Error] Failed to add AppState listener in RestTimerEmitter:', e);
      }
    }
  }

  getRemaining() {
    return this.remaining;
  }

  isActive() {
    return this.active;
  }

  subscribe(cb: (state: { remaining: number; active: boolean; endTarget?: number | null }) => void) {
    this.listeners.add(cb);
    cb({ remaining: this.remaining, active: this.active, endTarget: this.endTarget });
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit() {
    const state = { remaining: this.remaining, active: this.active, endTarget: this.endTarget };
    this.listeners.forEach(cb => cb(state));
  }

  start(duration: number) {
    this.stopInterval();
    this.remaining = duration;
    this.active = true;
    this.endTarget = Date.now() + duration * 1000;
    this.emit();
    scheduleRestTimerNotification(duration);

    this.intervalId = setInterval(() => {
      if (this.isDragging) return;
      if (!this.endTarget) return;

      const now = Date.now();
      const remainingSecs = Math.max(0, Math.ceil((this.endTarget - now) / 1000));
      this.remaining = remainingSecs;

      if (remainingSecs <= 0) {
        this.active = false;
        this.endTarget = null;
        this.stopInterval();
        this.emit();
        playTimerCompletedSound();
      } else {
        this.emit();
      }
    }, 1000);
  }

  stop() {
    this.stopInterval();
    this.remaining = 0;
    this.active = false;
    this.endTarget = null;
    this.emit();
    cancelRestTimerNotification();
    playSatisfyingClickStopTimer();
  }

  adjust(seconds: number) {
    if (!this.active || !this.endTarget) return;
    this.endTarget = this.endTarget + seconds * 1000;
    const now = Date.now();
    this.remaining = Math.max(0, Math.ceil((this.endTarget - now) / 1000));
    this.emit();
    scheduleRestTimerNotification(this.remaining);
  }

  setRemaining(secs: number) {
    this.remaining = secs;
    if (this.active) {
      this.endTarget = Date.now() + secs * 1000;
    }
    this.emit();
  }

  setIsDragging(dragging: boolean) {
    this.isDragging = dragging;
  }

  sync() {
    if (!this.active || !this.endTarget) return;
    const now = Date.now();
    const remainingSecs = Math.max(0, Math.ceil((this.endTarget - now) / 1000));
    this.remaining = remainingSecs;
    if (remainingSecs <= 0) {
      this.active = false;
      this.endTarget = null;
      this.stopInterval();
      this.emit();
      playTimerCompletedSound();
    } else {
      this.emit();
    }
  }

  private stopInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const restTimerEmitter = new RestTimerEmitter();
