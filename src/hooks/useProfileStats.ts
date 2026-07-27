import { useMemo } from 'react';
import { getWeeklyStreak } from '../screens/profileUtils';
import i18n from '../utils/i18n';

export interface UseProfileStatsOptions {
  sessions?: any[];
  weeklyChartData?: any[];
  exercises?: any[];
}

export function useProfileStats({
  sessions = [],
  weeklyChartData = [],
  exercises = [],
}: UseProfileStatsOptions = {}) {
  const chartData = useMemo(
    () => (weeklyChartData || []).map(d => ({ label: d.weekLabel, value: d.count })),
    [weeklyChartData]
  );

  const avgPerWeek = useMemo(() => {
    if (!weeklyChartData || weeklyChartData.length === 0) return 0;
    return weeklyChartData.reduce((s, d) => s + d.count, 0) / weeklyChartData.length;
  }, [weeklyChartData]);

  const { allTimeVolume, monthlyVolume, weeklyStreak } = useMemo(() => {
    let allTime = 0;
    let monthly = 0;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    (sessions || []).forEach(s => {
      const vol = s.totalVolumeKg || 0;
      allTime += vol;
      const sTime = new Date(s.datetime).getTime();
      if (!isNaN(sTime) && sTime >= thirtyDaysAgo) {
        monthly += vol;
      }
    });

    const streak = getWeeklyStreak(sessions || []);

    return {
      allTimeVolume: allTime,
      monthlyVolume: monthly,
      weeklyStreak: streak
    };
  }, [sessions]);

  const milestones = useMemo(() => {
    const totalW = sessions ? sessions.length : 0;
    const allVol = allTimeVolume;
    const has60m = sessions ? sessions.some(s => s.durationMinutes >= 60) : false;
    const hasCustom = exercises ? exercises.some(ex => ex.id && ex.id.startsWith('ex-custom-')) : false;
    const earlyBird = sessions ? sessions.some(s => {
      const date = new Date(s.datetime);
      return !isNaN(date.getTime()) && date.getHours() < 8;
    }) : false;
    const nightOwl = sessions ? sessions.some(s => {
      const date = new Date(s.datetime);
      return !isNaN(date.getTime()) && date.getHours() >= 20;
    }) : false;

    return [
      {
        id: 'consistency-king',
        title: i18n.t('badges.consistencyKing'),
        description: i18n.t('badges.consistencyKingDesc'),
        icon: 'calendar-outline' as const,
        unlocked: totalW >= 10,
      },
      {
        id: 'century-club',
        title: i18n.t('badges.centuryClub'),
        description: i18n.t('badges.centuryClubDesc'),
        icon: 'trophy-outline' as const,
        unlocked: totalW >= 100,
      },
      {
        id: 'heavy-lifter',
        title: i18n.t('badges.heavyLifter'),
        description: i18n.t('badges.heavyLifterDesc'),
        icon: 'barbell-outline' as const,
        unlocked: allVol >= 10000,
      },
      {
        id: 'titan',
        title: i18n.t('badges.titan'),
        description: i18n.t('badges.titanDesc'),
        icon: 'flame-outline' as const,
        unlocked: allVol >= 50000,
      },
      {
        id: 'iron-lungs',
        title: i18n.t('badges.ironLungs'),
        description: i18n.t('badges.ironLungsDesc'),
        icon: 'stopwatch-outline' as const,
        unlocked: has60m,
      },
      {
        id: 'innovator',
        title: i18n.t('badges.innovator'),
        description: i18n.t('badges.innovatorDesc'),
        icon: 'build-outline' as const,
        unlocked: hasCustom,
      },
      {
        id: 'early-bird',
        title: i18n.t('badges.earlyBird'),
        description: i18n.t('badges.earlyBirdDesc'),
        icon: 'sunny-outline' as const,
        unlocked: earlyBird,
      },
      {
        id: 'night-owl',
        title: i18n.t('badges.nightOwl'),
        description: i18n.t('badges.nightOwlDesc'),
        icon: 'moon-outline' as const,
        unlocked: nightOwl,
      },
    ];
  }, [sessions, allTimeVolume, exercises]);

  return {
    chartData,
    avgPerWeek,
    allTimeVolume,
    monthlyVolume,
    weeklyStreak,
    milestones,
  };
}
