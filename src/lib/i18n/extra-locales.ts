/**
 * Extra public locales beyond the core 6 (en/es/fr/pt/de/hi).
 * Picker stays at 18. English fills any key not overridden here.
 */

export const EXTRA_LOCALES = [
  'ar',
  'zh',
  'ja',
  'ko',
  'it',
  'nl',
  'pl',
  'ru',
  'tr',
  'vi',
  'id',
  'th',
] as const;

export type ExtraLocale = (typeof EXTRA_LOCALES)[number];

export const EXTRA_LOCALE_LABELS: Record<ExtraLocale, string> = {
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  id: 'Indonesia',
  th: 'ไทย',
};

export const extraOverrides: Record<ExtraLocale, Record<string, string>> = {
  ar: {
    'nav.lang': 'اللغة',
    'hero.badge': 'هذا الأسبوع • مجاني • بدون تسجيل',
    'leaderboard.title': 'النشاط الأخير',
    'lang.hint': 'لغة الصفحة',
  },
  zh: {
    'nav.lang': '语言',
    'hero.badge': '本周 • 免费 • 无需注册',
    'leaderboard.title': '最近动态',
    'lang.hint': '页面语言',
  },
  ja: {
    'nav.lang': '言語',
    'hero.badge': '今週 • 無料 • 登録不要',
    'leaderboard.title': '最近のアクティビティ',
    'lang.hint': 'ページの言語',
  },
  ko: {
    'nav.lang': '언어',
    'hero.badge': '이번 주 • 무료 • 가입 없음',
    'leaderboard.title': '최근 활동',
    'lang.hint': '페이지 언어',
  },
  it: {
    'nav.lang': 'Lingua',
    'hero.badge': 'QUESTA SETTIMANA • GRATIS • SENZA ISCRIZIONE',
    'leaderboard.title': 'Attività recente',
    'lang.hint': 'Lingua della pagina',
  },
  nl: {
    'nav.lang': 'Taal',
    'hero.badge': 'DEZE WEEK • GRATIS • GEEN AANMELDING',
    'leaderboard.title': 'Recente activiteit',
    'lang.hint': 'Paginataal',
  },
  pl: {
    'nav.lang': 'Język',
    'hero.badge': 'TEN TYDZIEŃ • ZA DARMO • BEZ REJESTRACJI',
    'leaderboard.title': 'Ostatnia aktywność',
    'lang.hint': 'Język strony',
  },
  ru: {
    'nav.lang': 'Язык',
    'hero.badge': 'НА ЭТОЙ НЕДЕЛЕ • БЕСПЛАТНО • БЕЗ РЕГИСТРАЦИИ',
    'leaderboard.title': 'Недавняя активность',
    'lang.hint': 'Язык страницы',
  },
  tr: {
    'nav.lang': 'Dil',
    'hero.badge': 'BU HAFTA • ÜCRETSİZ • KAYIT YOK',
    'leaderboard.title': 'Son etkinlik',
    'lang.hint': 'Sayfa dili',
  },
  vi: {
    'nav.lang': 'Ngôn ngữ',
    'hero.badge': 'TUẦN NÀY • MIỄN PHÍ • KHÔNG ĐĂNG KÝ',
    'leaderboard.title': 'Hoạt động gần đây',
    'lang.hint': 'Ngôn ngữ trang',
  },
  id: {
    'nav.lang': 'Bahasa',
    'hero.badge': 'MINGGU INI • GRATIS • TANPA DAFTAR',
    'leaderboard.title': 'Aktivitas terbaru',
    'lang.hint': 'Bahasa halaman',
  },
  th: {
    'nav.lang': 'ภาษา',
    'hero.badge': 'สัปดาห์นี้ • ฟรี • ไม่ต้องสมัคร',
    'leaderboard.title': 'กิจกรรมล่าสุด',
    'lang.hint': 'ภาษาของหน้า',
  },
};
