import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectBrowserLocale,
  normalizeLocale,
  t,
  applyI18n,
  setLocale,
  getLocale,
  isLocale,
} from '../../src/lib/i18n';
import { MESSAGES, SUPPORTED_LOCALES } from '../../src/lib/i18n/messages';

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
    expect(normalizeLocale('zh-CN')).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });

  it('detectBrowserLocale respects first preferred language', () => {
    expect(detectBrowserLocale({ languages: ['es-ES', 'en-US'] })).toBe('es');
    expect(detectBrowserLocale({ language: 'fr-FR' })).toBe('fr');
    expect(detectBrowserLocale({})).toBe('en');
  });

  it('t falls back to English for missing keys/locale', () => {
    expect(t('hero.cta', 'en')).toBe('Get my referral link');
    expect(t('hero.cta', 'es')).toBe('Get my referral link');
    expect(isLocale('es')).toBe(true);
    expect(isLocale('xx')).toBe(false);
  });

  it('applyI18n paints Spanish into data-i18n nodes', () => {
    applyI18n('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.documentElement.getAttribute('data-vr-locale')).toBe('es');
    expect(document.querySelector('[data-i18n="nav.how"]')?.textContent).toBe('Cómo');
    expect(document.querySelector('[data-i18n="hero.cta"]')?.textContent).toBe('Get my referral link');
  });

  it('setLocale persists and re-applies', () => {
    setLocale('pt');
    expect(getLocale()).toBe('pt');
    expect(localStorage.getItem('vr_locale')).toBe('pt');
    expect(document.querySelector('[data-i18n="hero.cta"]')?.textContent).toBe('Get my referral link');
  });

  it('every locale uses the English 7-day / 3 friends / no-cash prize facts', () => {
    const facts = [
      'hero.title_line1',
      'hero.title_accent',
      'hero.subtitle',
      'hero.cta',
      'funnel.badge',
      'funnel.step1',
      'funnel.step2',
      'funnel.step3',
      'how.badge',
      'how.subtitle',
      'how.step1_desc',
      'how.step2_title',
      'how.step2_desc',
      'how.step3_title',
      'how.step3_desc',
      'faq.q1',
      'faq.a1',
      'faq.q2',
      'faq.a2',
      'faq.q3',
      'faq.a3',
      'faq.q4',
      'faq.a4',
      'hero.prize_one',
      'hero.trust',
      'prize.title',
      'prize.subtitle',
      'prize.card2_desc',
      'prize.card3_desc',
      'prize.cta',
      'prize.winner_badge',
    ] as const;
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of facts) {
        expect(MESSAGES[locale][key]).toBe(MESSAGES.en[key]);
      }
      expect(MESSAGES[locale]['prize.subtitle']).toMatch(/7-day banner/);
      expect(MESSAGES[locale]['how.step3_desc']).toMatch(/3 friends/);
      expect(MESSAGES[locale]['prize.card2_desc'].toLowerCase()).toMatch(/no cash/);
      expect(MESSAGES[locale]['faq.a2'].toLowerCase()).toMatch(/no cash prize/);
      expect(MESSAGES[locale]['how.badge']).toBe('SITE DROP LADDER');
      expect(MESSAGES[locale]['funnel.badge']).toBe('SITE DROP LADDER');
      expect(MESSAGES[locale]['funnel.step3']).toBe('3. Site goes live');
      expect(MESSAGES[locale]['hero.title_line1']).toBe('Win the homepage.');
      expect(MESSAGES[locale]['funnel.step2']).toBe('2. Send it');
    }
  });
});
