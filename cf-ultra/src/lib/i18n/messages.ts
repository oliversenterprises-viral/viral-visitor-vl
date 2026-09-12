/**
 * Phase 1 public UI strings — global locale pack for the CF sibling.
 * English source of truth lives in ./en.ts; per-locale overrides in ./locales/.
 */

export { en, dict, type Dict, type MessageKey } from './en';
export {
  LOCALE_LABELS,
  LOCALE_SEARCH,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
  isRtlLocale,
  type Locale,
} from './locales';

import { dict, type Dict } from './en';
import type { Locale } from './locales';
import { ar } from './locales/ar';
import { bn } from './locales/bn';
import { de } from './locales/de';
import { es } from './locales/es';
import { fil } from './locales/fil';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { ms } from './locales/ms';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { ro } from './locales/ro';
import { ru } from './locales/ru';
import { sv } from './locales/sv';
import { sw } from './locales/sw';
import { th } from './locales/th';
import { tr } from './locales/tr';
import { uk } from './locales/uk';
import { ur } from './locales/ur';
import { vi } from './locales/vi';
import { zh } from './locales/zh';

export const MESSAGES: Record<Locale, Dict> = {
  en: dict({}),
  es,
  fr,
  pt,
  de,
  hi,
  ar,
  zh,
  ja,
  ko,
  ru,
  id,
  tr,
  it,
  nl,
  pl,
  vi,
  th,
  uk,
  bn,
  ur,
  ms,
  fil,
  sw,
  sv,
  ro,
};
