import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    // lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      // no-cache forces ETag revalidation so updated translation keys are picked up.
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      requestOptions: {
        cache: 'no-cache',
      },
    },
  });

export default i18n;
