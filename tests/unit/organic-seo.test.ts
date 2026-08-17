import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SEO_SITE_ORIGIN,
  HOMEPAGE_SEO,
  HOMEPAGE_FAQ,
  buildHomepageJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  initOrganicSeo,
} from '../../src/lib/organic-seo';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('organic-seo', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = 'test';
  });

  it('buildHomepageJsonLd includes WebSite, Organization, WebApplication, FAQPage', () => {
    const graphs = buildHomepageJsonLd();
    expect(graphs).toHaveLength(4);
    const types = graphs.map((g) => g['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('Organization');
    expect(types).toContain('WebApplication');
    expect(types).toContain('FAQPage');
    const faq = graphs.find((g) => g['@type'] === 'FAQPage') as {
      mainEntity: { name: string }[];
    };
    expect(faq.mainEntity).toHaveLength(HOMEPAGE_FAQ.length);
  });

  it('buildRobotsTxt allows Googlebot and points to sitemap', () => {
    const txt = buildRobotsTxt();
    expect(txt).toContain('User-agent: Googlebot');
    expect(txt).toContain(`Sitemap: ${SEO_SITE_ORIGIN}/sitemap.xml`);
    expect(txt).toContain('Disallow: /api/');
  });

  it('buildSitemapXml lists homepage sections', () => {
    const xml = buildSitemapXml(SEO_SITE_ORIGIN, '2026-07-04');
    expect(xml).toContain('<loc>https://www.viralrefer.app/</loc>');
    expect(xml).toContain('<lastmod>2026-07-04</lastmod>');
    expect(xml).toContain('/rules/');
    expect(xml).not.toContain('#leaderboard');
  });

  it('initOrganicSeo sets canonical on homepage', () => {
    initOrganicSeo({ pathname: '/', search: '', hash: '' } as Location);
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    expect(canonical?.href).toBe('https://www.viralrefer.app/');
    const jsonLd = document.getElementById('vr-organic-jsonld');
    expect(jsonLd?.textContent).toContain('FAQPage');
  });

  it('initOrganicSeo skips referral landing pages', () => {
    initOrganicSeo({ pathname: '/r/VIRAL-TEST01', search: '', hash: '' } as Location);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('homepage SEO + static OG match the prize-first hero', () => {
    expect(HOMEPAGE_SEO.title).toBe('Win the ViralRefer homepage — #1 gets a banner');
    expect(HOMEPAGE_SEO.description).toMatch(/racing for the ViralRefer homepage/);
    expect(HOMEPAGE_SEO.description).toMatch(/banner/);
    expect(HOMEPAGE_SEO.description).toMatch(/beat me/);
    expect(HOMEPAGE_SEO.ogImage).toBe(`${SEO_SITE_ORIGIN}/assets/og-homepage-banner-v2.png`);

    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain(`content="${HOMEPAGE_SEO.title}"`);
    expect(html).toContain(HOMEPAGE_SEO.description);
    expect(html).toContain('https://www.viralrefer.app/assets/og-homepage-banner-v2.png');
    expect(html).not.toContain('og:title" content="ViralRefer • Free Worldwide Referral Leaderboard');
  });
});
