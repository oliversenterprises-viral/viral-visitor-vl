/**
 * Phase 1 i18n — browser language + manual override.
 * Safe defaults: English fallback, never blocks render, admin untranslated.
 */

import {
  LOCALE_LABELS,
  MESSAGES,
  SUPPORTED_LOCALES,
  type Locale,
  type MessageKey,
  en,
} from './messages';

export type { Locale, MessageKey };
export { LOCALE_LABELS, SUPPORTED_LOCALES };

const STORAGE_KEY = 'vr_locale';
const ATTR = 'data-vr-locale';

let current: Locale = 'en';
let applied = false;

export function isLocale(raw: string | null | undefined): raw is Locale {
  return !!raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw);
}

/** Map navigator / Accept-Language tags → supported locale. */
export function normalizeLocale(tag: string | null | undefined): Locale {
  if (!tag) return 'en';
  const base = tag.trim().toLowerCase().split(/[-_]/)[0] || 'en';
  if (base === 'en') return 'en';
  if (base === 'es') return 'es';
  if (base === 'fr') return 'fr';
  if (base === 'pt') return 'pt';
  if (base === 'de') return 'de';
  if (base === 'hi') return 'hi';
  // Portuguese Brazil / European already covered by pt
  // Chinese etc. → English until Phase 2
  return 'en';
}

export function detectBrowserLocale(
  nav: { language?: string; languages?: readonly string[] } = typeof navigator !== 'undefined'
    ? navigator
    : {},
): Locale {
  const list = nav.languages?.length ? [...nav.languages] : nav.language ? [nav.language] : [];
  if (!list.length) return 'en';
  // Respect browser priority order (first preferred language wins)
  return normalizeLocale(list[0]);
}

export function getStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* non-fatal */
  }
}

/** Resolved locale: user override → browser → en */
export function resolveLocale(): Locale {
  return getStoredLocale() ?? detectBrowserLocale();
}

export function getLocale(): Locale {
  return current;
}

export function t(key: MessageKey, locale: Locale = current): string {
  return MESSAGES[locale]?.[key] ?? en[key] ?? key;
}

/** Apply all [data-i18n] / [data-i18n-attr] / [data-i18n-placeholder] under root. */
export function applyI18n(locale: Locale = current, root: ParentNode = document): void {
  current = locale;

  try {
    document.documentElement.lang = locale === 'en' ? 'en' : locale;
    document.documentElement.setAttribute(ATTR, locale);
  } catch {
    /* non-fatal */
  }

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as MessageKey | null;
    if (!key || !(key in en)) return;
    // Preserve child icons: if first element child is <i>, only replace text nodes / trailing span
    const icon = el.querySelector(':scope > i.fa-solid, :scope > i.fa-brands, :scope > i[class*="fa-"]');
    if (icon && el.childNodes.length > 1) {
      // Keep icons, set text on last text-ish content or dedicated span
      const textSpan = el.querySelector('[data-i18n-text]') as HTMLElement | null;
      if (textSpan) {
        textSpan.textContent = t(key, locale);
      } else {
        // Replace only text nodes
        let replaced = false;
        el.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            node.textContent = ` ${t(key, locale)}`;
            replaced = true;
          }
        });
        if (!replaced) {
          const span = document.createElement('span');
          span.setAttribute('data-i18n-text', '');
          span.textContent = t(key, locale);
          el.appendChild(span);
        }
      }
    } else {
      el.textContent = t(key, locale);
    }
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder') as MessageKey | null;
    if (!key || !(key in en)) return;
    if ('placeholder' in el) (el as HTMLInputElement).placeholder = t(key, locale);
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria') as MessageKey | null;
    if (!key || !(key in en)) return;
    el.setAttribute('aria-label', t(key, locale));
  });

  // Sync language picker if present
  const select = document.getElementById('vr-lang-select') as HTMLSelectElement | null;
  if (select && select.value !== locale) select.value = locale;

  applied = true;
}

export function setLocale(locale: Locale): void {
  if (!isLocale(locale)) locale = 'en';
  setStoredLocale(locale);
  applyI18n(locale);
  // Notify listeners (share copy, stats, etc.)
  try {
    window.dispatchEvent(new CustomEvent('vr:locale-change', { detail: { locale } }));
  } catch {
    /* non-fatal */
  }
}

function buildLangPicker(): void {
  if (document.getElementById('vr-lang-select')) return;
  const navLinks = document.querySelector('.vr-nav-links');
  if (!navLinks) return;

  const wrap = document.createElement('label');
  wrap.className = 'vr-lang-picker';
  wrap.setAttribute('title', t('lang.hint'));
  wrap.innerHTML = `
    <span class="sr-only">${t('nav.lang')}</span>
    <select id="vr-lang-select" class="vr-lang-select" aria-label="${t('nav.lang')}">
      ${SUPPORTED_LOCALES.map(
        (loc) => `<option value="${loc}">${LOCALE_LABELS[loc]}</option>`,
      ).join('')}
    </select>
  `;

  // Insert before admin button if present
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn?.parentElement === navLinks) {
    navLinks.insertBefore(wrap, adminBtn);
  } else {
    navLinks.appendChild(wrap);
  }

  const select = wrap.querySelector('#vr-lang-select') as HTMLSelectElement;
  select.value = current;
  select.addEventListener('change', () => {
    const next = select.value;
    setLocale(isLocale(next) ? next : 'en');
  });
}

/** Footer language row (desktop-friendly secondary control). */
function buildFooterLangNote(): void {
  if (document.getElementById('vr-lang-footer')) return;
  // Prefer the legal footer block near rules links
  const rulesLink = document.getElementById('footer-link-rules');
  const parent = rulesLink?.parentElement;
  if (!parent) return;

  const note = document.createElement('div');
  note.id = 'vr-lang-footer';
  note.className = 'vr-lang-footer text-xs text-zinc-500 mt-2';
  note.innerHTML = `<span data-i18n="lang.hint">${t('lang.hint')}</span>: <strong id="vr-lang-footer-label">${LOCALE_LABELS[current]}</strong>`;
  parent.appendChild(note);
}

/** Idempotent bootstrap — call early in main.ts */
export function initI18n(): void {
  if (typeof document === 'undefined') return;
  // Skip inside admin-only surfaces if ever isolated; public SPA is fine
  current = resolveLocale();
  applyI18n(current);
  buildLangPicker();
  buildFooterLangNote();
  applied = true;
}

/** Re-apply after CMS / hero A/B paints English over static HTML. */
export function reapplyI18n(): void {
  if (!applied) {
    initI18n();
    return;
  }
  applyI18n(current);
  const footerLabel = document.getElementById('vr-lang-footer-label');
  if (footerLabel) footerLabel.textContent = LOCALE_LABELS[current];
}

export function isI18nApplied(): boolean {
  return applied;
}
