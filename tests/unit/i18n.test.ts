import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
import {
  detectBrowserLocale,
  normalizeLocale,
  t,
  applyI18n,
  setLocale,
  getLocale,
  isLocale,
  initI18n,
  SUPPORTED_LOCALES,
} from '../../src/lib/i18n';
import { MESSAGES } from '../../src/lib/i18n/messages';
import { EXTRA_LOCALES } from '../../src/lib/i18n/extra-locales';

describe('i18n phase 1', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-vr-locale');
    document.body.innerHTML = `
      <div class="vr-nav-links">
        <a data-i18n="nav.how">How</a>
        <button id="admin-btn">ADMIN</button>
      </div>
      <span id="hero-title-line1" data-i18n="hero.title_line1">Get your free link in 30 seconds.</span>
      <button id="hero-get-link-btn"><span data-i18n="hero.cta">Get my referral link</span></button>
    `;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('normalizeLocale maps language tags', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('pt-BR')).toBe('pt');
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('de-DE')).toBe('de');
    expect(normalizeLocale('hi-IN')).toBe('hi');
    expect(normalizeLocale('zh-CN')).toBe('zh');
    expect(normalizeLocale('ja-JP')).toBe('ja');
    expect(normalizeLocale('ar-SA')).toBe('ar');
    expect(normalizeLocale('xx-ZZ')).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });

  it('detectBrowserLocale respects first preferred language', () => {
    expect(detectBrowserLocale({ languages: ['es-ES', 'en-US'] })).toBe('es');
    expect(detectBrowserLocale({ language: 'fr-FR' })).toBe('fr');
    expect(detectBrowserLocale({})).toBe('en');
  });

  it('t falls back to English for missing keys/locale', () => {
    expect(t('hero.cta', 'en')).toMatch(/get my referral link/i);
    expect(t('hero.cta', 'es')).toMatch(/enlace/i);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('xx')).toBe(false);
  });

  it('applyI18n paints Spanish into data-i18n nodes', () => {
    applyI18n('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.documentElement.getAttribute('data-vr-locale')).toBe('es');
    expect(document.querySelector('[data-i18n="nav.how"]')?.textContent).toBe('Cómo');
    expect(document.querySelector('[data-i18n="hero.cta"]')?.textContent).toMatch(/enlace/i);
  });

  it('setLocale persists and re-applies', () => {
    setLocale('pt');
    expect(getLocale()).toBe('pt');
    expect(localStorage.getItem('vr_locale')).toBe('pt');
    expect(document.querySelector('[data-i18n="hero.cta"]')?.textContent).toMatch(/indicação|link/i);
  });

  it('keeps 18 locales and never shrinks the picker to 6', () => {
    expect(EXTRA_LOCALES).toHaveLength(12);
    expect(SUPPORTED_LOCALES).toHaveLength(18);
    expect(new Set(SUPPORTED_LOCALES).size).toBe(18);
    for (const loc of ['en', 'es', 'fr', 'pt', 'de', 'hi', ...EXTRA_LOCALES]) {
      expect(isLocale(loc)).toBe(true);
    }
  });

  it('sets leaderboard.title to Recent Activity in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const title = MESSAGES[locale]['leaderboard.title'];
      expect(title).toBeTruthy();
      expect(title).not.toMatch(/early leaderboard/i);
      expect(title).not.toMatch(/this week's race/i);
      expect(title).not.toMatch(/live leaderboard/i);
    }
    expect(MESSAGES.en['leaderboard.title']).toBe('Recent Activity');
    expect(t('leaderboard.title', 'en')).toBe('Recent Activity');
  });

  it('sets hero.badge to THIS WEEK in English', () => {
    expect(MESSAGES.en['hero.badge']).toBe('THIS WEEK • FREE • NO SIGNUP');
    expect(t('hero.badge', 'en')).toMatch(/this week/i);
    expect(t('hero.badge', 'en')).not.toMatch(/worldwide/i);
  });

  it('wires #vr-lang-select with all 18 options', () => {
    initI18n();
    const select = document.getElementById('vr-lang-select') as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    expect(select?.options.length).toBe(18);
    const values = [...(select?.options ?? [])].map((opt) => opt.value);
    expect(values).toEqual([...SUPPORTED_LOCALES]);
  });

  it('paints Recent Activity onto #leaderboard-title', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<h2 id="leaderboard-title" data-i18n="leaderboard.title">This week\'s race</h2>',
    );
    applyI18n('en');
    expect(document.getElementById('leaderboard-title')?.textContent).toBe('Recent Activity');
  });
});

describe('owner Site Drops i18n HTML lock', () => {
  it('first-paint ladder title and hero badge match the 18-locale dictionary', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/id="leaderboard-title"[^>]*>Recent Activity</);
    expect(html).toMatch(/data-i18n="leaderboard.title"/);
    expect(html).not.toMatch(/id="leaderboard-title"[^>]*>Early Leaderboard</);
    expect(html).not.toMatch(/id="leaderboard-title"[^>]*>This week's race</);
    expect(html).toMatch(/data-i18n="hero.badge"/);
    expect(html).toMatch(/THIS WEEK &bull; FREE &bull; NO SIGNUP/);
    expect(html).toContain('Your site here');
  });
});
