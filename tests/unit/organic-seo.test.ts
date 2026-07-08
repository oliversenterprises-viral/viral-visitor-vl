import { describe, it, expect, beforeEach } from 'vitest';
import {
  SEO_SITE_ORIGIN,
  HOMEPAGE_FAQ,
  buildHomepageJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  initOrganicSeo,
} from '../../src/lib/organic-seo';

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
    expect(xml).toContain('#leaderboard');
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
});