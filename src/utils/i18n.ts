import { I18n } from 'i18n-js';
import { I18nManager, Platform } from 'react-native';

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
      restartRequired: 'Language Changed',
      restartMessage: 'The language has been changed successfully.',
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
      restartRequired: 'השפה שונתה',
      restartMessage: 'השפה שונתה בהצלחה.',
      ok: 'אישור',
    }
  }
};

const i18n = new I18n(translations);
i18n.locale = I18nManager.isRTL ? 'he' : 'en';
i18n.enableFallback = true;

// Listener for language changes
let languageChangeListener: ((locale: string) => void) | null = null;

export function setLanguageChangeListener(listener: ((locale: string) => void) | null) {
  languageChangeListener = listener;
}

/**
 * Switch the app language and trigger a hot-reload.
 */
export function switchLanguage(locale: 'en' | 'he') {
  const isRTL = locale === 'he';

  // Update i18n locale
  i18n.locale = locale;

  // Update RTL layout
  I18nManager.forceRTL(isRTL);
  I18nManager.allowRTL(isRTL);

  // Notify listener to trigger re-render
  if (languageChangeListener) {
    languageChangeListener(locale);
  }
}

export default i18n;
