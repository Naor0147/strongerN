import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from './i18n';

export const REST_TIMER_CHANNEL_ID = 'rest-timer';
export const WORKOUT_CHANNEL_ID = 'workout-progress';
export const DAILY_REMINDER_CHANNEL_ID = 'daily-reminder';

let foregroundSuppressed = false;
let scheduledRestTimerId: string | null = null;
let activeWorkoutNotifId: string | null = null;
let scheduledDailyReminderIds: string[] = [];

export async function initNotifications() {
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: !foregroundSuppressed,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: !foregroundSuppressed,
      shouldShowList: !foregroundSuppressed,
    }),
  });

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
        name: 'Rest Timer',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F8EF7',
      });
      await Notifications.setNotificationChannelAsync(WORKOUT_CHANNEL_ID, {
        name: 'Workout Progress',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F8EF7',
      });
      await Notifications.setNotificationChannelAsync(DAILY_REMINDER_CHANNEL_ID, {
        name: 'Workout Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F8EF7',
      });
    } catch (e) {
      console.warn('[Notifications Error] Failed to set channels:', e);
    }
  }

  try {
    await Notifications.requestPermissionsAsync();
  } catch (e) {
    // swallow errors/best-effort
  }
}

export function setForegroundSuppression(suppressed: boolean) {
  foregroundSuppressed = suppressed;
}

export async function scheduleRestTimerNotification(durationSec: number) {
  if (Platform.OS === 'web') return;
  await cancelRestTimerNotification();

  if (durationSec > 0) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notifications.restTimerDone') || 'Rest Timer Completed',
          body: "Time's up! Get ready for your next set.",
          sound: true,
          data: { type: 'rest-timer' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: durationSec,
          channelId: REST_TIMER_CHANNEL_ID,
        },
      });
      scheduledRestTimerId = id;
    } catch (e) {
      console.warn('[Notifications Error] Failed to schedule rest timer:', e);
    }
  }
}

export async function cancelRestTimerNotification() {
  if (Platform.OS === 'web') return;
  if (scheduledRestTimerId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(scheduledRestTimerId);
      await Notifications.dismissNotificationAsync(scheduledRestTimerId);
    } catch (e) {
      // Ignore errors
    }
    scheduledRestTimerId = null;
  }
}

export async function showWorkoutBackgroundNotification({ title, body }: { title: string; body: string }) {
  if (Platform.OS === 'web') return null;
  await dismissWorkoutBackgroundNotification();

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        sound: false,
        data: { type: 'workout' },
      },
      trigger: null, // trigger: null for immediate notification in Expo SDK 54
    });
    activeWorkoutNotifId = id;
    return id;
  } catch (e) {
    console.warn('[Notifications Error] Failed to show background workout notification:', e);
    return null;
  }
}

export async function dismissWorkoutBackgroundNotification() {
  if (Platform.OS === 'web') return;
  if (activeWorkoutNotifId) {
    try {
      await Notifications.dismissNotificationAsync(activeWorkoutNotifId);
    } catch (e) {
      // Ignore errors
    }
    activeWorkoutNotifId = null;
  }
}

/**
 * Schedule weekly repeating workout reminder notifications for scheduled training days.
 * @param workoutDays Array of weekday numbers (1 = Sunday, 2 = Monday, ..., 7 = Saturday)
 * @param hour Hour of the day (0-23)
 * @param minute Minute of the hour (0-59)
 */
export async function scheduleDailyWorkoutReminders(
  workoutDays: number[],
  hour: number = 9,
  minute: number = 0,
  customTitle?: string,
  customBody?: string
) {
  if (Platform.OS === 'web') return;

  await cancelDailyWorkoutReminders();

  if (!workoutDays || workoutDays.length === 0) return;

  const defaultTitle = customTitle || i18n.t('notifications.workoutReminderTitle') || 'Workout Day!';
  const defaultBody = customBody || i18n.t('notifications.timeToTrain') || 'Time to train 💪';

  for (const day of workoutDays) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: defaultTitle,
          body: defaultBody,
          sound: true,
          data: { type: 'daily-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour,
          minute,
          channelId: DAILY_REMINDER_CHANNEL_ID,
        },
      });
      scheduledDailyReminderIds.push(id);
    } catch (e) {
      console.warn(`[Notifications Error] Failed to schedule reminder for day ${day}:`, e);
    }
  }
}

export async function cancelDailyWorkoutReminders() {
  if (Platform.OS === 'web') return;

  for (const id of scheduledDailyReminderIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      // Ignore
    }
  }
  scheduledDailyReminderIds = [];
}

export async function getLastNotificationResponse() {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (e) {
    return null;
  }
}

export function onNotificationTapped(cb: (response: Notifications.NotificationResponse) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(cb);
  return () => {
    subscription.remove();
  };
}

export function isWorkoutNotificationResponse(response: any): boolean {
  if (!response) return false;
  const content = response.notification?.request?.content;
  const trigger = response.notification?.request?.trigger;
  const channelId = trigger?.channelId || content?.channelId;

  if (content?.data?.type === 'workout') return true;
  if (channelId === WORKOUT_CHANNEL_ID) return true;

  if (content?.data?.type === 'rest-timer') return false;
  if (channelId === REST_TIMER_CHANNEL_ID) return false;

  if (content?.title && content.title.toLowerCase().includes('timer')) return false;

  return false;
}
