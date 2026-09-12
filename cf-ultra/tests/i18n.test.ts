import { describe, expect, it } from 'vitest';
import { teSplashHtml } from '../functions/_lib/te-splash';
import { embedWidgetHtml } from '../functions/_lib/og';
import {
  detectBrowserLocale,
  isLocale,
  normalizeLocale,
  t,
} from '../src/lib/i18n';
import { LOCALE_LABELS, MESSAGES, SUPPORTED_LOCALES } from '../src/lib/i18n/messages';

describe('Phase 1 i18n (CF sibling)', () => {
  it('supports the live locale set', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'es', 'fr', 'pt', 'de', 'hi']);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('zh')).toBe(false);
    expect(LOCALE_LABELS.hi).toBe('हिन्दी');
  });

  it('maps browser tags and falls back to English', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('pt-BR')).toBe('pt');
    expect(normalizeLocale('de-DE')).toBe('de');
    expect(normalizeLocale('hi-IN')).toBe('hi');
    expect(normalizeLocale('zh-CN')).toBe('en');
    expect(detectBrowserLocale({ languages: ['fr-FR', 'en'] })).toBe('fr');
    expect(detectBrowserLocale({})).toBe('en');
  });

  it('interpolates and falls back to English', () => {
    expect(t('ref.title', 'es', { code: 'VIRAL-ABC1234' })).toContain('VIRAL-ABC1234');
    expect(t('hero.cta', 'es')).toMatch(/enlace/i);
    expect(t('hero.cta', 'fr')).not.toBe(t('hero.cta', 'en'));
    expect(t('nav.how', 'en')).toBe('How');
    expect(MESSAGES.es['faq.q1']).not.toBe(MESSAGES.en['faq.q1']);
    expect(MESSAGES.de['drops.title']).not.toBe(MESSAGES.en['drops.title']);
    expect(MESSAGES.hi['kit.send']).toBeTruthy();
  });

  it('keeps Site Drops copy from inventing visit-counts', () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(MESSAGES[loc]['how.step2_desc_drop'].toLowerCase()).not.toMatch(/every visit can count|cada visita puede contar/);
    }
  });
});

describe('TE / embed edge i18n', () => {
  it('marks splash strings and ships the apply snippet', () => {
    const html = teSplashHtml({
      origin: 'https://demo.example',
      url: new URL('https://demo.example/te?src=te'),
    });
    expect(html).toContain('data-i18n="te.lead"');
    expect(html).toContain('vr_locale');
    expect(html).toContain('Get my link');
  });

  it('marks the embed CTA', () => {
    const html = embedWidgetHtml({
      origin: 'https://demo.example',
      host: 'example.com',
      site: null,
      credits: 0,
      weekly: 0,
      rung: 'entered',
    });
    expect(html).toContain('data-i18n="embed.go"');
    expect(html).toContain('Get my link');
    expect(html).toContain('vr_locale');
  });
});
