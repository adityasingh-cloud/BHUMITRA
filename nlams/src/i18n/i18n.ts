// nlams/src/i18n/i18n.ts
/**
 * i18n initialization for the BHUMITRA website (formerly NLAMS).
 * Uses react‑i18next with the browser‑language detector.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation resources – each file exports a JSON object.
import en from '../locales/en/translation.json';
import hi from '../locales/hi/translation.json';
import bn from '../locales/bn/translation.json';
import te from '../locales/te/translation.json';
import mr from '../locales/mr/translation.json';
import ta from '../locales/ta/translation.json';
import gu from '../locales/gu/translation.json';
import ur from '../locales/ur/translation.json';
import kn from '../locales/kn/translation.json';
import ml from '../locales/ml/translation.json';
import or from '../locales/or/translation.json';
import pa from '../locales/pa/translation.json';
import as from '../locales/as/translation.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  te: { translation: te },
  mr: { translation: mr },
  ta: { translation: ta },
  gu: { translation: gu },
  ur: { translation: ur },
  kn: { translation: kn },
  ml: { translation: ml },
  or: { translation: or },
  pa: { translation: pa },
  as: { translation: as },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: { escapeValue: false },
    detection: {
      // Order and from where user language should be detected
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      // Keys or params to lookup language from
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
