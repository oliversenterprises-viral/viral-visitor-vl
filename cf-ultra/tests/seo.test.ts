import { describe, expect, it } from 'vitest';
import { crawlerOgHtml } from '../functions/_lib/og';
import { decorateHomepageHtml } from '../functions/_lib/homepage-seo';
import { goLandingHtml, teLandingHtml } from '../functions/_lib/public-landings';
import { teSplashHtml } from '../functions/_lib/te-splash';
import { localeFromSearchParams } from '../src/lib/i18n';
import {
  HOMEPAGE_FAQ,
  SEO_DEFAULT_ORIGIN,
  SEO_LOCALES,
  buildHomepageJsonLd,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  homepageOgSvg,
  isPublicAssetPath,
  isSeoBot,
  languageUrl,
  localeFromSearch,
  sitemapUrlEntries,
  wantsCompactTe,
} from '../src/lib/organic-seo';

const SAMPLE_HOME = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Win the ViralRefer homepage — Site Drops + #1 banner</title>
  <meta name="description" content="old">
  <link rel="canonical" href="https://viralrefer-ultra.pages.dev/">
  <meta property="og:url" content="https://viralrefer-ultra.pages.dev/">
  <script type="application/ld+json" id="vr-organic-jsonld">[]</script>
</head>
<body>
  <h1><span data-i18n="hero.title_line1">Win the homepage.</span></h1>
  <p data-i18n="faq.a2">Yes. No payment. No email. No cash prize.</p>
</body>
</html>`;

describe('organic SEO builders', () => {
  it('allows public pages and points at the sitemap', () => {
    const txt = buildRobotsTxt('https://example.test');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Disallow: /api/');
    expect(txt).toContain('Allow: /api/og');
    expect(txt).toContain('Allow: /llms.txt');
    expect(txt).toContain('Sitemap: https://example.test/sitemap.xml');
    expect(txt).toContain('GPTBot');
  });

  it('lists homepage, TE, go, promo, and ?lang= variants', () => {
    const xml = buildSitemapXml(SEO_DEFAULT_ORIGIN);
    expect(xml).toContain(`${SEO_DEFAULT_ORIGIN}/`);
    expect(xml).toContain(`${SEO_DEFAULT_ORIGIN}/te`);
    expect(xml).toContain(`${SEO_DEFAULT_ORIGIN}/go`);
    expect(xml).toContain(`${SEO_DEFAULT_ORIGIN}/promo/te/`);
    expect(xml).toContain(`${SEO_DEFAULT_ORIGIN}/?lang=es`);
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('hreflang="ja"');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/join');
    expect(sitemapUrlEntries().length).toBeGreaterThan(20);
  });

  it('keeps llms files honest', () => {
    const short = buildLlmsTxt(SEO_DEFAULT_ORIGIN);
    const full = buildLlmsFullTxt(SEO_DEFAULT_ORIGIN);
    expect(short).toContain('No cash prize');
    expect(short).toContain('Get my link');
    expect(short).not.toMatch(/\$[0-9]|4\.9 stars|1,000,000 users/i);
    expect(short).toContain('Do not invent star ratings, MRR');
    expect(full).toContain('What not to say');
    expect(full).toContain('/te');
    expect(full).toContain('?lang=');
  });

  it('emits SoftwareApplication + FAQ JSON-LD without fake ratings', () => {
    const graph = JSON.stringify(buildHomepageJsonLd(SEO_DEFAULT_ORIGIN));
    expect(graph).toContain('SoftwareApplication');
    expect(graph).toContain('FAQPage');
    expect(graph).toContain('Organization');
    expect(graph).toContain(HOMEPAGE_FAQ[0].question);
    expect(graph).not.toContain('aggregateRating');
    expect(graph).not.toContain('ratingValue');
    expect(graph).toContain('"price":"0"');
  });

  it('maps language query aliases', () => {
    expect(localeFromSearch('?lang=es')).toBe('es');
    expect(localeFromSearch('lang=zh-CN')).toBe('zh');
    expect(localeFromSearch('?locale=tl')).toBe('fil');
    expect(localeFromSearch('?lang=xx')).toBeNull();
    expect(languageUrl(SEO_DEFAULT_ORIGIN, '/', 'es')).toBe(`${SEO_DEFAULT_ORIGIN}/?lang=es`);
    expect(languageUrl(SEO_DEFAULT_ORIGIN, '/', 'en')).toBe(`${SEO_DEFAULT_ORIGIN}/`);
    expect(SEO_LOCALES).toHaveLength(26);
  });

  it('treats iframe/size as compact TE, not cloaking', () => {
    const full = new URL('https://example.test/te');
    const sized = new URL('https://example.test/te?size=468x60');
    const view = new URL('https://example.test/te?view=full');
    expect(wantsCompactTe(new Request(full), full)).toBe(false);
    expect(wantsCompactTe(new Request(sized), sized)).toBe(true);
    expect(wantsCompactTe(new Request(view), view)).toBe(false);
    expect(
      wantsCompactTe(
        new Request(full, { headers: { 'sec-fetch-dest': 'iframe' } }),
        full,
      ),
    ).toBe(true);
    expect(isSeoBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isPublicAssetPath('/')).toBe(true);
    expect(isPublicAssetPath('/te')).toBe(true);
    expect(isPublicAssetPath('/promo/te/')).toBe(true);
    expect(isPublicAssetPath('/this-is-not-a-page')).toBe(false);
  });

  it('ships a homepage OG SVG', () => {
    expect(homepageOgSvg()).toContain('Win the homepage');
    expect(homepageOgSvg()).toContain('1200');
  });
});

describe('i18n URL language', () => {
  it('reads ?lang= before storage', () => {
    expect(localeFromSearchParams('?lang=ja&ref=VIRAL-ABC1234')).toBe('ja');
    expect(localeFromSearchParams('?locale=pt-BR')).toBe('pt');
    expect(localeFromSearchParams('')).toBeNull();
  });
});

describe('decorated homepage HTML', () => {
  it('rewrites origin, canonical, and Spanish visible copy', () => {
    const url = new URL('https://preview.example/?lang=es');
    const html = decorateHomepageHtml(SAMPLE_HOME, url);
    expect(html).toContain('lang="es"');
    expect(html).toContain('https://preview.example/?lang=es');
    expect(html).toContain('Gana la portada. — ViralRefer Site Drops');
    expect(html).toContain('Gana la portada.');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('SoftwareApplication');
  });
});

describe('public landings', () => {
  it('gives /te unique indexable copy and /go a different job', () => {
    const te = teLandingHtml({
      origin: 'https://example.test',
      url: new URL('https://example.test/te?src=te&camp=demo'),
    });
    const go = goLandingHtml({
      origin: 'https://example.test',
      url: new URL('https://example.test/go?src=te'),
    });
    expect(te).toContain('index, follow');
    expect(te).toContain('Honest rotator destinations');
    expect(te).toContain('src=te');
    expect(te).not.toMatch(/\$10,000|cash prize of/i);
    expect(go).toContain('You left the rotator');
    expect(go).toContain('Continue to Get my link');
    expect(go).not.toBe(te);
  });

  it('keeps sized TE splash noindex and compact', () => {
    const splash = teSplashHtml({
      origin: 'https://example.test',
      url: new URL('https://example.test/te?size=468x60'),
    });
    expect(splash).toContain('noindex');
    expect(splash).toContain('Get my link');
  });

  it('noindexes personal share OG cards', () => {
    const og = crawlerOgHtml({
      origin: 'https://example.test',
      code: 'VIRAL-ABC1234',
      canonicalUrl: 'https://example.test/r/VIRAL-ABC1234',
      ogUrl: 'https://example.test/r/VIRAL-ABC1234',
      credits: 0,
      weekly: 0,
      demoMode: false,
    });
    expect(og).toContain('noindex');
    expect(og).toContain('VIRAL-ABC1234');
  });
});
