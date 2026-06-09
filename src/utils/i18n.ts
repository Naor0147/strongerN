import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
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
i18n.locale = Localization.getLocales()[0]?.languageTag || 'en';
i18n.enableFallback = true;

export default i18n;
