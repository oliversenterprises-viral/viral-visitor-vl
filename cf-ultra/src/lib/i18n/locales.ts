/**
 * Global Phase 1 locale registry for the Cloudflare Site Drops sibling.
 * Admin HQ stays English and does not import this picker.
 */

export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'fr',
  'pt',
  'de',
  'hi',
  'ar',
  'zh',
  'ja',
  'ko',
  'ru',
  'id',
  'tr',
  'it',
  'nl',
  'pl',
  'vi',
  'th',
  'uk',
  'bn',
  'ur',
  'ms',
  'fil',
  'sw',
  'sv',
  'ro',
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES = ['ar', 'ur'] as const;

export function isRtlLocale(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

/** Native endonym shown in the picker. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  de: 'Deutsch',
  hi: 'हिन्दी',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
  id: 'Bahasa Indonesia',
  tr: 'Türkçe',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  uk: 'Українська',
  bn: 'বাংলা',
  ur: 'اردو',
  ms: 'Bahasa Melayu',
  fil: 'Filipino',
  sw: 'Kiswahili',
  sv: 'Svenska',
  ro: 'Română',
};

/** Extra tokens so the picker search finds “Chinese”, “Arabic”, etc. */
export const LOCALE_SEARCH: Record<Locale, string> = {
  en: 'english en',
  es: 'spanish español espanol es',
  fr: 'french français francais fr',
  pt: 'portuguese português portugues brazil brasil pt',
  de: 'german deutsch de',
  hi: 'hindi हिन्दी हिंदू hi india',
  ar: 'arabic العربية ar rtl',
  zh: 'chinese simplified mandarin 中文 简体 zh cn',
  ja: 'japanese 日本語 ja jp',
  ko: 'korean 한국어 ko kr',
  ru: 'russian русский ru',
  id: 'indonesian bahasa indonesia id',
  tr: 'turkish türkçe turkce tr',
  it: 'italian italiano it',
  nl: 'dutch nederlands nl',
  pl: 'polish polski pl',
  vi: 'vietnamese tiếng việt tieng viet vi',
  th: 'thai ไทย th',
  uk: 'ukrainian українська ua uk',
  bn: 'bengali bangla বাংলা bn',
  ur: 'urdu اردو ur rtl pakistan',
  ms: 'malay melayu malaysia ms',
  fil: 'filipino tagalog pilipino tl ph',
  sw: 'swahili kiswahili sw',
  sv: 'swedish svenska sv',
  ro: 'romanian română romana ro',
};

/**
 * Extra Accept-Language / navigator tags that are not the first subtag.
 * Common region tags (zh-CN, pt-BR) are handled by first-subtag match.
 */
export const LOCALE_ALIASES: Record<string, Locale> = {
  tl: 'fil',
  'fil-ph': 'fil',
  'tl-ph': 'fil',
  in: 'id',
  'zh-cn': 'zh',
  'zh-sg': 'zh',
  'zh-hans': 'zh',
  'zh-hans-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
  'zh-hant': 'zh',
  'pt-br': 'pt',
  'pt-pt': 'pt',
};

export const LOCALE_GROUPS: { id: string; locales: readonly Locale[] }[] = [
  { id: 'core', locales: ['en', 'es', 'fr', 'pt', 'de', 'hi'] },
  { id: 'asia', locales: ['zh', 'ja', 'ko', 'id', 'vi', 'th', 'ms', 'fil', 'bn'] },
  { id: 'mena', locales: ['ar', 'ur', 'tr'] },
  { id: 'europe', locales: ['ru', 'uk', 'it', 'nl', 'pl', 'sv', 'ro'] },
  { id: 'africa', locales: ['sw'] },
];
