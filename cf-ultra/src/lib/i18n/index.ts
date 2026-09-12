/**
 * Phase 1 i18n — browser language + manual override.
 * Safe defaults: English fallback, never blocks render, admin untranslated.
 */

import { LOCALE_ALIASES, LOCALE_SEARCH, isRtlLocale } from './locales';
import {
  LOCALE_LABELS,
  MESSAGES,
  SUPPORTED_LOCALES,
  type Locale,
  type MessageKey,
  en,
} from './messages';

export type { Locale, MessageKey };
export { LOCALE_LABELS, SUPPORTED_LOCALES, isRtlLocale };

const STORAGE_KEY = 'vr_locale';
const ATTR = 'data-vr-locale';

let current: Locale = 'en';
let applied = false;

export function isLocale(raw: string | null | undefined): raw is Locale {
  return !!raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw);
}

function canonTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, '-');
}

/** Map a single tag to a supported locale, or null if unknown. */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const raw = canonTag(tag);
  if (isLocale(raw)) return raw;
  const aliased = LOCALE_ALIASES[raw];
  if (aliased) return aliased;
  const base = raw.split('-')[0] || '';
  if (isLocale(base)) return base;
  const baseAlias = LOCALE_ALIASES[base];
  return baseAlias ?? null;
}

/** Map navigator / Accept-Language tags → supported locale. */
export function normalizeLocale(tag: string | null | undefined): Locale {
  return matchLocale(tag) ?? 'en';
}

export function detectBrowserLocale(
  nav: { language?: string; languages?: readonly string[] } = typeof navigator !== 'undefined'
    ? navigator
    : {},
): Locale {
  const list = nav.languages?.length ? [...nav.languages] : nav.language ? [nav.language] : [];
  for (const tag of list) {
    const loc = matchLocale(tag);
    if (loc) return loc;
  }
  return 'en';
}

/** Filter picker rows by native name, English tokens, or locale code. */
export function filterLocales(query: string): Locale[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SUPPORTED_LOCALES];
  return SUPPORTED_LOCALES.filter((loc) => {
    const hay = `${loc} ${LOCALE_LABELS[loc]} ${LOCALE_SEARCH[loc]}`.toLowerCase();
    return hay.includes(q);
  });
}

function applyDocumentLocale(locale: Locale): void {
  try {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute(ATTR, locale);
  } catch {
    /* non-fatal */
  }
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

export function t(
  key: MessageKey,
  localeOrVars?: Locale | Record<string, string | number>,
  maybeVars?: Record<string, string | number>,
): string {
  let locale: Locale = current;
  let vars: Record<string, string | number> | undefined;
  if (typeof localeOrVars === 'string' && isLocale(localeOrVars)) {
    locale = localeOrVars;
    vars = maybeVars;
  } else if (localeOrVars && typeof localeOrVars === 'object') {
    vars = localeOrVars;
  }
  let out = MESSAGES[locale]?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}

/** Apply all [data-i18n] / [data-i18n-placeholder] / [data-i18n-aria] under root. */
export function applyI18n(locale: Locale = current, root: ParentNode = document): void {
  current = locale;

  applyDocumentLocale(locale);

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as MessageKey | null;
    if (!key || !(key in en)) return;
    const icon = el.querySelector(':scope > i.fa-solid, :scope > i.fa-brands, :scope > i[class*="fa-"]');
    if (icon && el.childNodes.length > 1) {
      const textSpan = el.querySelector('[data-i18n-text]') as HTMLElement | null;
      if (textSpan) {
        textSpan.textContent = t(key, locale);
      } else {
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

  document.querySelectorAll<HTMLSelectElement>('.vr-lang-select').forEach((select) => {
    if (select.value !== locale) select.value = locale;
  });
  document.querySelectorAll<HTMLInputElement>('.vr-lang-search').forEach((input) => {
    input.placeholder = t('lang.search', locale);
    input.setAttribute('aria-label', t('lang.search', locale));
  });
  document.querySelectorAll<HTMLButtonElement>('.vr-lang-trigger').forEach((btn) => {
    btn.setAttribute('aria-label', t('nav.lang', locale));
  });
  syncLangTriggers(locale);

  const footerLabel = document.getElementById('vr-lang-footer-label');
  if (footerLabel) footerLabel.textContent = LOCALE_LABELS[locale];

  applied = true;
}

export function setLocale(locale: Locale): void {
  if (!isLocale(locale)) locale = 'en';
  setStoredLocale(locale);
  applyI18n(locale);
  try {
    window.dispatchEvent(new CustomEvent('vr:locale-change', { detail: { locale } }));
  } catch {
    /* non-fatal */
  }
}

function wireLangSelect(select: HTMLSelectElement): void {
  if (select.dataset.vrLangBound === '1') return;
  select.dataset.vrLangBound = '1';
  select.value = current;
  select.addEventListener('change', () => {
    const next = select.value;
    setLocale(isLocale(next) ? next : 'en');
  });
}

function optionHtml(): string {
  return SUPPORTED_LOCALES.map(
    (loc) => `<option value="${loc}">${LOCALE_LABELS[loc]}</option>`,
  ).join('');
}

function listItemHtml(loc: Locale, selected: Locale): string {
  const active = loc === selected ? ' aria-selected="true"' : '';
  return `<li role="option" class="vr-lang-option${loc === selected ? ' is-active' : ''}" data-locale="${loc}"${active}><span class="vr-lang-option-native">${LOCALE_LABELS[loc]}</span><span class="vr-lang-option-code">${loc}</span></li>`;
}

function fillLangList(list: HTMLElement, query: string, selected: Locale): void {
  const rows = filterLocales(query);
  list.innerHTML = rows.length
    ? rows.map((loc) => listItemHtml(loc, selected)).join('')
    : `<li class="vr-lang-empty" role="presentation">${t('lang.search')}</li>`;
}

function syncLangTriggers(locale: Locale): void {
  document.querySelectorAll<HTMLElement>('.vr-lang-trigger-label').forEach((el) => {
    el.textContent = LOCALE_LABELS[locale];
  });
  document.querySelectorAll<HTMLElement>('.vr-lang-trigger-code').forEach((el) => {
    el.textContent = locale.toUpperCase();
  });
  document.querySelectorAll<HTMLElement>('.vr-lang-option').forEach((el) => {
    const on = el.getAttribute('data-locale') === locale;
    el.classList.toggle('is-active', on);
    if (on) el.setAttribute('aria-selected', 'true');
    else el.removeAttribute('aria-selected');
  });
}

function closeLangMenus(except?: HTMLElement | null): void {
  document.querySelectorAll<HTMLElement>('.vr-lang-picker.is-open').forEach((picker) => {
    if (except && picker === except) return;
    picker.classList.remove('is-open');
    const btn = picker.querySelector<HTMLButtonElement>('.vr-lang-trigger');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    const panel = picker.querySelector<HTMLElement>('.vr-lang-panel');
    if (panel) panel.hidden = true;
  });
}

function wireSearchablePicker(wrap: HTMLElement): void {
  if (wrap.dataset.vrLangBound === '1') return;
  wrap.dataset.vrLangBound = '1';

  const trigger = wrap.querySelector<HTMLButtonElement>('.vr-lang-trigger');
  const panel = wrap.querySelector<HTMLElement>('.vr-lang-panel');
  const search = wrap.querySelector<HTMLInputElement>('.vr-lang-search');
  const list = wrap.querySelector<HTMLElement>('.vr-lang-list');
  const select = wrap.querySelector<HTMLSelectElement>('.vr-lang-select');
  if (!trigger || !panel || !search || !list) return;

  if (select) wireLangSelect(select);
  fillLangList(list, '', current);

  const open = (): void => {
    closeLangMenus(wrap);
    wrap.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    fillLangList(list, search.value, current);
    window.requestAnimationFrame(() => search.focus());
  };

  const close = (): void => {
    wrap.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    search.value = '';
  };

  trigger.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (wrap.classList.contains('is-open')) close();
    else open();
  });

  search.addEventListener('input', () => fillLangList(list, search.value, current));
  search.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
      trigger.focus();
    }
  });

  list.addEventListener('click', (ev) => {
    const item = (ev.target as HTMLElement).closest<HTMLElement>('[data-locale]');
    if (!item) return;
    const next = item.getAttribute('data-locale');
    close();
    setLocale(isLocale(next) ? next : 'en');
  });

  if (!document.documentElement.dataset.vrLangDocListen) {
    document.documentElement.dataset.vrLangDocListen = '1';
    document.addEventListener('click', (ev) => {
      const target = ev.target as Node | null;
      document.querySelectorAll<HTMLElement>('.vr-lang-picker.is-open').forEach((picker) => {
        if (target && picker.contains(target)) return;
        picker.classList.remove('is-open');
        const btn = picker.querySelector<HTMLButtonElement>('.vr-lang-trigger');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        const p = picker.querySelector<HTMLElement>('.vr-lang-panel');
        if (p) p.hidden = true;
      });
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeLangMenus();
    });
  }
}

function createLangPickerWrap(selectId: string, extraClass = ''): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `vr-lang-picker ${extraClass}`.trim();
  wrap.setAttribute('title', t('lang.hint'));
  wrap.innerHTML = `
    <span class="sr-only">${t('nav.lang')}</span>
    <button type="button" class="vr-lang-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="${t('nav.lang')}">
      <span class="vr-lang-trigger-code" aria-hidden="true">${current.toUpperCase()}</span>
      <span class="vr-lang-trigger-label">${LOCALE_LABELS[current]}</span>
    </button>
    <div class="vr-lang-panel" hidden>
      <input type="search" class="vr-lang-search" autocomplete="off" placeholder="${t('lang.search')}" aria-label="${t('lang.search')}" />
      <ul class="vr-lang-list" role="listbox"></ul>
    </div>
    <select id="${selectId}" class="vr-lang-select vr-lang-select--sr" aria-hidden="true" tabindex="-1">
      ${optionHtml()}
    </select>
  `;
  wireSearchablePicker(wrap);
  return wrap;
}

/** Compact language control for /embed traffic-exchange layout. */
export function mountEmbedLangPicker(): void {
  if (typeof document === 'undefined') return;
  if (!document.documentElement.hasAttribute('data-vr-embed')) return;

  const slot = document.getElementById('vr-embed-lang-slot');
  if (!slot) return;
  if (slot.querySelector('.vr-lang-select')) {
    const existing = slot.querySelector('.vr-lang-select') as HTMLSelectElement;
    wireLangSelect(existing);
    existing.value = current;
    return;
  }

  const wrap = createLangPickerWrap('vr-lang-select-embed', 'vr-lang-picker--embed');
  slot.appendChild(wrap);
}

function buildLangPicker(): void {
  if (document.documentElement.hasAttribute('data-vr-embed')) {
    mountEmbedLangPicker();
    if (!document.getElementById('vr-lang-select-embed')) {
      window.setTimeout(() => mountEmbedLangPicker(), 80);
      window.setTimeout(() => mountEmbedLangPicker(), 300);
    }
    return;
  }

  if (document.getElementById('vr-lang-select')) return;
  const navLinks = document.querySelector('.vr-nav-links');
  if (!navLinks) return;

  const wrap = createLangPickerWrap('vr-lang-select');
  const adminBtn = document.getElementById('admin-btn');
  const getLink = document.getElementById('nav-get-link-btn');
  if (adminBtn?.parentElement === navLinks) {
    navLinks.insertBefore(wrap, adminBtn);
  } else if (getLink?.parentElement === navLinks) {
    navLinks.insertBefore(wrap, getLink);
  } else {
    navLinks.appendChild(wrap);
  }
}

/** Footer language row (desktop-friendly secondary control). */
function buildFooterLangNote(): void {
  if (document.getElementById('vr-lang-footer')) return;
  const rulesLink = document.getElementById('footer-link-rules');
  const slot = document.getElementById('vr-lang-footer-slot');
  const parent = slot || rulesLink?.parentElement || document.querySelector('footer .max-w-5xl');
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
  current = resolveLocale();
  applyI18n(current);
  buildLangPicker();
  buildFooterLangNote();
  applyI18n(current);

  if (!document.documentElement.dataset.vrEmbedLangListen) {
    document.documentElement.dataset.vrEmbedLangListen = '1';
    window.addEventListener('vr:embed-chrome-ready', () => {
      mountEmbedLangPicker();
    });
  }

  applied = true;
}

/** Re-apply after CMS / hero paints English over static HTML. */
export function reapplyI18n(): void {
  if (!applied) {
    initI18n();
    return;
  }
  applyI18n(current);
  mountEmbedLangPicker();
  const footerLabel = document.getElementById('vr-lang-footer-label');
  if (footerLabel) footerLabel.textContent = LOCALE_LABELS[current];
}

export function isI18nApplied(): boolean {
  return applied;
}
