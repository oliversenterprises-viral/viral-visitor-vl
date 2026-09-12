import { describe, expect, it } from 'vitest';
import { teSplashHtml } from '../functions/_lib/te-splash';
import { embedWidgetHtml } from '../functions/_lib/og';
import {
  detectBrowserLocale,
  filterLocales,
  isLocale,
  isRtlLocale,
  normalizeLocale,
  t,
} from '../src/lib/i18n';
import { LOCALE_LABELS, MESSAGES, SUPPORTED_LOCALES } from '../src/lib/i18n/messages';
import { en } from '../src/lib/i18n/en';

const NEW_LOCALES = [
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

describe('Phase 1 i18n (CF sibling)', () => {
  it('supports the global locale set', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(26);
    expect([...SUPPORTED_LOCALES].slice(0, 6)).toEqual(['en', 'es', 'fr', 'pt', 'de', 'hi']);
    for (const loc of NEW_LOCALES) {
      expect(isLocale(loc)).toBe(true);
      expect(LOCALE_LABELS[loc]).toBeTruthy();
    }
    expect(isLocale('xx')).toBe(false);
    expect(LOCALE_LABELS.hi).toBe('हिन्दी');
    expect(LOCALE_LABELS.ar).toBe('العربية');
    expect(LOCALE_LABELS.zh).toBe('中文');
    expect(LOCALE_LABELS.fil).toBe('Filipino');
  });

  it('marks Arabic and Urdu as RTL', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('ur')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
    expect(isRtlLocale('he')).toBe(false);
  });

  it('maps browser tags and falls back to English', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('pt-BR')).toBe('pt');
    expect(normalizeLocale('de-DE')).toBe('de');
    expect(normalizeLocale('hi-IN')).toBe('hi');
    expect(normalizeLocale('zh-CN')).toBe('zh');
    expect(normalizeLocale('zh-Hans')).toBe('zh');
    expect(normalizeLocale('ja-JP')).toBe('ja');
    expect(normalizeLocale('ko-KR')).toBe('ko');
    expect(normalizeLocale('ar-SA')).toBe('ar');
    expect(normalizeLocale('ur-PK')).toBe('ur');
    expect(normalizeLocale('id-ID')).toBe('id');
    expect(normalizeLocale('fil-PH')).toBe('fil');
    expect(normalizeLocale('tl')).toBe('fil');
    expect(normalizeLocale('tl-PH')).toBe('fil');
    expect(normalizeLocale('uk-UA')).toBe('uk');
    expect(normalizeLocale('sv-SE')).toBe('sv');
    expect(normalizeLocale('xx-YY')).toBe('en');
    expect(detectBrowserLocale({ languages: ['fr-FR', 'en'] })).toBe('fr');
    expect(detectBrowserLocale({ languages: ['xx-YY', 'ja-JP'] })).toBe('ja');
    expect(detectBrowserLocale({})).toBe('en');
  });

  it('filters the picker by native name, English name, or code', () => {
    expect(filterLocales('arab')).toContain('ar');
    expect(filterLocales('中文')).toContain('zh');
    expect(filterLocales('fil')).toContain('fil');
    expect(filterLocales('tagalog')).toContain('fil');
    expect(filterLocales('zzzz-nope')).toEqual([]);
  });

  it('interpolates and falls back to English', () => {
    expect(t('ref.title', 'es', { code: 'VIRAL-ABC1234' })).toContain('VIRAL-ABC1234');
    expect(t('hero.cta', 'es')).toMatch(/enlace/i);
    expect(t('hero.cta', 'fr')).not.toBe(t('hero.cta', 'en'));
    expect(t('nav.how', 'en')).toBe('How');
    expect(MESSAGES.es['faq.q1']).not.toBe(MESSAGES.en['faq.q1']);
    expect(MESSAGES.de['drops.title']).not.toBe(MESSAGES.en['drops.title']);
    expect(MESSAGES.hi['kit.send']).toBeTruthy();
    expect(t('hero.cta_short', 'zh')).toMatch(/链接/);
    expect(t('hero.cta_short', 'ar')).toBeTruthy();
    expect(t('embed.go', 'ja')).not.toBe(t('embed.go', 'en'));
  });

  it('keeps Site Drops copy from inventing visit-counts', () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(MESSAGES[loc]['how.step2_desc_drop'].toLowerCase()).not.toMatch(
        /every visit can count|cada visita puede contar/,
      );
    }
  });

  it('keeps the CF hero title as win-the-homepage, not the old banner line', () => {
    expect(MESSAGES.en['hero.title_line1']).toBe('Win the homepage.');
    expect(MESSAGES.es['hero.title_line1']).toBe('Gana la portada.');
    expect(MESSAGES.fr['hero.title_line1']).toMatch(/page d.accueil/i);
  });

  it('ships every English key on the new global locales', () => {
    const keys = Object.keys(en);
    expect(keys).toContain('lang.search');
    for (const loc of NEW_LOCALES) {
      for (const key of keys) {
        expect(MESSAGES[loc][key as keyof typeof en], `${loc} ${key}`).toBeTruthy();
      }
      expect(MESSAGES[loc]['hero.cta_short']).not.toBe(MESSAGES.en['hero.cta_short']);
      expect(MESSAGES[loc]['faq.a2']).not.toBe(MESSAGES.en['faq.a2']);
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
    expect(html).toContain('"ar"');
    expect(html).toContain('"zh"');
    expect(html).toContain('"fil"');
    expect(html).toMatch(/dir=.*rtl|rtl.*dir/);
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
    expect(html).toContain('"ja"');
  });
});
