import i18n from '../utils/i18n';

export const EMPTY_ARRAY: any[] = [];
export const EMPTY_OBJECT: Record<string, any> = {};

export const formatLastSynced = (isoString: string | null): string => {
  if (!isoString) return i18n.t('extras.neverBackedUp');
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return i18n.t('extras.lastSyncedJustNow');
  if (diffMins < 60) return i18n.t('extras.lastSyncedAgo', { time: `${diffMins}m` });
  return i18n.t('extras.lastSyncedDate', { date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
};

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  // Get Monday start
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

export const getWeeklyStreak = (sessionsList: any[]): number => {
  if (!sessionsList || sessionsList.length === 0) return 0;

  const weekStarts = new Set<number>();
  sessionsList.forEach(s => {
    const date = new Date(s.datetime);
    if (isNaN(date.getTime())) return;
    const start = getStartOfWeek(date);
    weekStarts.add(start.getTime());
  });

  const now = new Date();
  const currentWeekStart = getStartOfWeek(now).getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  let streak = 0;
  let checkWeek = currentWeekStart;

  if (weekStarts.has(currentWeekStart)) {
    streak = 1;
    checkWeek = currentWeekStart - oneWeekMs;
    while (weekStarts.has(checkWeek)) {
      streak++;
      checkWeek -= oneWeekMs;
    }
  } else {
    const lastWeekStart = currentWeekStart - oneWeekMs;
    if (weekStarts.has(lastWeekStart)) {
      streak = 1;
      checkWeek = lastWeekStart - oneWeekMs;
      while (weekStarts.has(checkWeek)) {
        streak++;
        checkWeek -= oneWeekMs;
      }
    }
  }
  return streak;
};
