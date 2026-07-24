import { Platform } from 'react-native';
import i18n from './i18n';

export const WORKOUT_LIVE_CHANNEL_ID = 'workout-live';

let isForegroundServiceRegistered = false;
let isServiceRunning = false;
let notifeeModule: any = null;
let AndroidImportanceEnum: any = { HIGH: 4 };

function getNotifee() {
  if (Platform.OS === 'web') return null;
  if (!notifeeModule) {
    try {
      const mod = require('react-native-notify-kit');
      notifeeModule = mod.default || mod;
      if (mod.AndroidImportance) {
        AndroidImportanceEnum = mod.AndroidImportance;
      }
    } catch (e) {
      console.warn('[ForegroundNotif] Failed to load notify-kit:', e);
      return null;
    }
  }
  return notifeeModule;
}

/**
 * Register headless task handler at app bundle load time.
 * On Android, this MUST execute before AppRegistry or backgrounding.
 */
export function registerForegroundServiceHeadless() {
  if (Platform.OS === 'web') return;
  const notifee = getNotifee();
  if (!notifee) return;

  try {
    if (!isForegroundServiceRegistered) {
      notifee.registerForegroundService((_notification: any) => {
        return new Promise(() => {
          // Task runs continuously until stopForegroundService() is called
        });
      });
      isForegroundServiceRegistered = true;
    }
  } catch (e) {
    console.warn('[ForegroundNotif Error] Headless service registration failed:', e);
  }
}

// Auto-register headless task handler as early as possible
registerForegroundServiceHeadless();

/**
 * Initialize the Android Foreground Service channel & runner.
 */
export async function initForegroundNotification() {
  if (Platform.OS === 'web') return;

  const notifee = getNotifee();
  if (!notifee) return;

  try {
    registerForegroundServiceHeadless();

    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: WORKOUT_LIVE_CHANNEL_ID,
        name: i18n.t('notifications.activeWorkoutNotification') || 'Workout Progress',
        importance: AndroidImportanceEnum.HIGH,
        vibration: true,
        vibrationPattern: [0, 250, 250, 250],
        lights: true,
        lightColor: '#4F8EF7',
      });
    }
  } catch (e) {
    console.warn('[ForegroundNotif Error] Init failed:', e);
  }
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Start the Android Foreground Service when app is minimized during a workout.
 */
export async function startWorkoutForeground(workoutName: string) {
  if (Platform.OS === 'web') return;

  const notifee = getNotifee();
  if (!notifee) return;

  try {
    await initForegroundNotification();

    const title = workoutName || i18n.t('notifications.activeWorkoutNotification') || 'Workout';
    const body = i18n.t('notifications.workoutInProgress') || 'Workout in progress';

    await notifee.displayNotification({
      id: 'workout-foreground-service',
      title,
      body,
      android: {
        channelId: WORKOUT_LIVE_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        showChronometer: true,
        color: '#4F8EF7',
        colorized: false,
        onlyAlertOnce: true,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });

    isServiceRunning = true;
  } catch (e) {
    console.warn('[ForegroundNotif Error] Failed to start foreground service:', e);
  }
}

/**
 * Update the background notification to show the live rest timer countdown.
 */
export async function updateTimerCountdown(remainingSec: number, workoutName: string) {
  if (Platform.OS === 'web' || !isServiceRunning) return;

  const notifee = getNotifee();
  if (!notifee) return;

  try {
    const title = workoutName || i18n.t('notifications.activeWorkoutNotification') || 'Workout';
    const timeStr = formatDuration(remainingSec);
    const bodyText = i18n.t('notifications.restRemaining', { time: timeStr }) || `Rest: ${timeStr} remaining`;

    await notifee.displayNotification({
      id: 'workout-foreground-service',
      title,
      body: bodyText,
      android: {
        channelId: WORKOUT_LIVE_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        color: '#4F8EF7',
        onlyAlertOnce: true,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });
  } catch (e) {
    console.warn('[ForegroundNotif Error] Failed to update timer countdown:', e);
  }
}

/**
 * Trigger completion alert (sound + vibration + notification update) when rest timer hits 0 in background.
 */
export async function showTimerComplete(workoutName: string) {
  if (Platform.OS === 'web') return;

  const notifee = getNotifee();
  if (!notifee) return;

  try {
    const title = workoutName || i18n.t('notifications.activeWorkoutNotification') || 'Workout';
    const bodyText = i18n.t('notifications.restTimerDone') || 'Rest complete — next set ready!';

    await notifee.displayNotification({
      id: 'workout-foreground-service',
      title,
      body: bodyText,
      android: {
        channelId: WORKOUT_LIVE_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        color: '#22D97A',
        vibrationPattern: [0, 400, 200, 400],
        onlyAlertOnce: false,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });
  } catch (e) {
    console.warn('[ForegroundNotif Error] Failed to show timer complete notification:', e);
  }
}

/**
 * Stop the Android Foreground Service and dismiss the notification when app returns to foreground or workout finishes.
 */
export async function stopWorkoutForeground() {
  if (Platform.OS === 'web' || !isServiceRunning) return;

  const notifee = getNotifee();
  if (!notifee) return;

  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification('workout-foreground-service');
    isServiceRunning = false;
  } catch (e) {
    console.warn('[ForegroundNotif Error] Failed to stop foreground service:', e);
    isServiceRunning = false;
  }
}

export function isForegroundServiceActive(): boolean {
  return isServiceRunning;
}
