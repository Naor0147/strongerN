import { I18n } from 'i18n-js';
import { I18nManager } from 'react-native';

const translations = {
  en: {
    tabs: {
      profile: 'Profile',
      history: 'History',
      workout: 'Workout',
      exercises: 'Exercises',
      muscles: 'Muscles',
    },
    settings: {
      language: 'Language',
      english: 'English',
      hebrew: 'Hebrew',
      restartRequired: 'Restart Required',
      restartMessage: 'You must restart the app to apply the language and layout changes.',
      ok: 'OK',
    }
  },
  he: {
    tabs: {
      profile: 'פרופיל',
      history: 'היסטוריה',
      workout: 'אימון',
      exercises: 'תרגילים',
      muscles: 'שרירים',
    },
    settings: {
      language: 'שפה',
      english: 'אנגלית',
      hebrew: 'עברית',
      restartRequired: 'נדרשת הפעלה מחדש',
      restartMessage: 'יש להפעיל מחדש את האפליקציה כדי להחיל את שינויי השפה והתצוגה.',
      ok: 'אישור',
    }
  }
};

const i18n = new I18n(translations);
i18n.locale = (I18nManager && I18nManager.isRTL) ? 'he' : 'en';
i18n.enableFallback = true;

const EXERCISE_TRANSLATIONS: Record<string, string> = {
  'bench press': 'לחיצת חזה',
  'barbell bench press': 'לחיצת חזה עם מוט',
  'incline bench press': 'לחיצת חזה בשיפוע חיובי',
  'incline barbell bench press': 'לחיצת חזה בשיפוע חיובי עם מוט',
  'decline bench press': 'לחיצת חזה בשיפוע שלילי',
  'squat': 'סקוואט',
  'back squat': 'סקוואט אחורי',
  'front squat': 'סקוואט קדמי',
  'deadlift': 'דדליפט',
  'barbell deadlift': 'דדליפט עם מוט',
  'overhead press': 'לחיצת כתפיים מעל הראש',
  'barbell overhead press': 'לחיצת כתפיים עם מוט',
  'dumbbell overhead press': 'לחיצת כתפיים עם משקולות יד',
  'barbell row': 'חתירה עם מוט',
  'bent over row': 'חתירה בהטיה',
  'pull-up': 'מתח',
  'pull up': 'מתח',
  'pullups': 'מתח',
  'chin-up': 'עליות מתח באחיזה הפוכה',
  'chin up': 'עליות מתח באחיזה הפוכה',
  'chinups': 'עליות מתח באחיזה הפוכה',
  'bicep curl': 'כפיפת מרפקים',
  'bicep curls': 'כפיפת מרפקים',
  'dumbbell bicep curl': 'כפיפת מרפקים עם משקולות יד',
  'tricep extension': 'פשיטת מרפקים',
  'tricep extensions': 'פשיטת מרפקים',
  'overhead tricep extension': 'פשיטת מרפקים מעל הראש',
  'cable tricep pushdown': 'פשיטת מרפקים בפולי עליון',
  'lateral raise': 'הרחקת זרועות הצידה',
  'lateral raises': 'הרחקת זרועות הצידה',
  'dumbbell lateral raise': 'הרחקת זרועות הצידה עם משקולות יד',
  'push-up': 'שכיבות סמיכה',
  'push up': 'שכיבות סמיכה',
  'pushups': 'שכיבות סמיכה',
  'lunge': 'לאנג׳',
  'lunges': 'לאנג׳ים',
  'dumbbell lunges': 'לאנג׳ים עם משקולות יד',
  'bulgarian split squat': 'סקוואט בולגרי',
  'bulgarian split squats': 'סקוואט בולגרי',
  'leg press': 'לחיצת רגליים',
  'leg extension': 'פשיטת ברכיים',
  'leg curl': 'כפיפת ברכיים',
  'calf raise': 'הערמת עקבים',
  'calf raises': 'הערמת עקבים',
  'standing calf raise': 'הערמת עקבים בעמידה',
  'seated calf raise': 'הערמת עקבים בישיבה',
  'face pull': 'פייס פולס',
  'face pulls': 'פייס פולס',
  'cable crunch': 'כפיפות בטן בכבל',
  'plank': 'פלאנק',
  'russian twist': 'פיתול רוסי',
  'concentration curl': 'כפיפת ריכוז',
  'concentration curls': 'כפיפת ריכוז',
  'dumbbell curl': 'כפיפת מרפקים עם משקולות יד',
  'dumbbell curls': 'כפיפת מרפקים עם משקולות יד',
  'hammer curl': 'כפיפת פטישים',
  'hammer curls': 'כפיפת פטישים',
  'pec deck': 'פרפר במכשיר',
  'chest fly': 'פרפר',
  'dumbbell chest fly': 'פרפר עם משקולות יד',
  'lat pulldown': 'משיכת פולי עליון',
  'seated row': 'חתירה בישיבה',
  'seated cable row': 'חתירה בישיבה בפולי',
  'dips': 'מקבילים',
  'chest dips': 'מקבילים לחזה',
  'shrugs': 'משיכת כתפיים',
  'dumbbell shrugs': 'משיכת כתפיים עם משקולות יד',
  'barbell shrugs': 'משיכת כתפיים עם מוט',
};

export function translateExerciseName(name: string): string {
  if (!name) return name;
  if (i18n.locale !== 'he') return name;
  const clean = name.toLowerCase().trim();
  return EXERCISE_TRANSLATIONS[clean] || name;
}

export default i18n;
