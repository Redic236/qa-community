import i18next from 'i18next';
import * as middleware from 'i18next-http-middleware';
import zhCNErrors from './locales/zh-CN/errors.json';
import enUSErrors from './locales/en-US/errors.json';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Resources are bundled at import time so req.t() is callable as soon as the
// middleware mounts — no async race in tests or first-request hot paths.
const resources = {
  'zh-CN': { errors: zhCNErrors },
  'en-US': { errors: enUSErrors },
};

let initialized = false;

export function initI18n(): typeof i18next {
  if (initialized) return i18next;
  void i18next.use(middleware.LanguageDetector).init({
    resources,
    // Chinese is the primary user base; fall back to it when Accept-Language
    // is missing or specifies an unsupported locale.
    fallbackLng: 'zh-CN',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    ns: ['errors'],
    defaultNS: 'errors',
    detection: {
      order: ['header'],
      caches: false,
    },
    interpolation: { escapeValue: false },
  });
  initialized = true;
  return i18next;
}

export const i18nextMiddleware = middleware;
export { i18next };
