import { describe, it, expect, beforeEach } from 'vitest';
import {
  SEO_SITE_ORIGIN,
  HOMEPAGE_FAQ,
  AEO_ENTITY_DEFINITION,
  buildHomepageJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  buildLlmsTxt,
  initOrganicSeo,
  mountAeoContent,
} from '../../src/lib/organic-seo';

describe('organic-seo + AEO', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.title = 'test';
  });

  it('entity definition is a clear extractable answer', () => {
    expect(AEO_ENTITY_DEFINITION.toLowerCase()).toContain('viralrefer');
    expect(AEO_ENTITY_DEFINITION.toLowerCase()).toContain('free');
    expect(AEO_ENTITY_DEFINITION.toLowerCase()).toContain('leaderboard');
    expect(AEO_ENTITY_DEFINITION.toLowerCase()).toContain('no cash prize');
    expect(AEO_ENTITY_DEFINITION.length).toBeGreaterThan(80);
  });

  it('FAQ covers core AEO questions', () => {
    expect(HOMEPAGE_FAQ.length).toBeGreaterThanOrEqual(6);
    const qs = HOMEPAGE_FAQ.map((f) => f.question.toLowerCase()).join(' ');
    expect(qs).toMatch(/what is viralrefer/);
    expect(qs).toMatch(/free/);
    expect(qs).toMatch(/leaderboard|referral/);
    expect(qs).toMatch(/#1|number 1|top|cash|email|copy|sign up|signup/i);
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
    const org = graphs.find((g) => g['@type'] === 'Organization') as {
      sameAs?: string[];
      description?: string;
    };
    expect(org.sameAs?.length).toBeGreaterThan(0);
    expect(org.description).toContain('ViralRefer');
  });

  it('buildRobotsTxt allows Googlebot, AI crawlers, and points to sitemap', () => {
    const txt = buildRobotsTxt();
    expect(txt).toContain('User-agent: Googlebot');
    expect(txt).toContain('User-agent: GPTBot');
    expect(txt).toContain('User-agent: PerplexityBot');
    expect(txt).toContain(`Sitemap: ${SEO_SITE_ORIGIN}/sitemap.xml`);
    expect(txt).toContain('Disallow: /api/');
  });

  it('buildSitemapXml lists homepage, FAQ, and llms.txt', () => {
    const xml = buildSitemapXml(SEO_SITE_ORIGIN, '2026-07-13');
    expect(xml).toContain('<loc>https://www.viralrefer.app/</loc>');
    expect(xml).toContain('#faq');
    expect(xml).toContain('llms.txt');
    expect(xml).toContain('<lastmod>2026-07-13</lastmod>');
    expect(xml).toContain('#leaderboard');
  });

  it('buildLlmsTxt exposes entity facts for AI assistants', () => {
    const txt = buildLlmsTxt();
    expect(txt).toContain('# ViralRefer');
    expect(txt).toContain(AEO_ENTITY_DEFINITION.slice(0, 40));
    expect(txt).toContain('https://www.viralrefer.app');
    expect(txt.toLowerCase()).toContain('no cash');
  });

  it('mountAeoContent fills FAQ list and entity definition', () => {
    document.body.innerHTML = `
      <p id="aeo-entity-definition">old</p>
      <div id="aeo-faq-list"></div>
    `;
    mountAeoContent();
    expect(document.getElementById('aeo-entity-definition')?.textContent).toBe(
      AEO_ENTITY_DEFINITION,
    );
    const items = document.querySelectorAll('#aeo-faq-list .aeo-faq-item');
    expect(items.length).toBe(HOMEPAGE_FAQ.length);
    expect(document.querySelector('.aeo-faq-q')?.textContent).toMatch(/What is ViralRefer/i);
  });

  it('initOrganicSeo sets canonical on homepage and mounts AEO', () => {
    document.body.innerHTML = `
      <meta name="description" content="old">
      <p id="aeo-entity-definition"></p>
      <div id="aeo-faq-list"></div>
    `;
    // meta in body for jsdom simplicity — still queryable
    initOrganicSeo({ pathname: '/', search: '', hash: '' } as Location);
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    expect(canonical?.href).toBe('https://www.viralrefer.app/');
    const jsonLd = document.getElementById('vr-organic-jsonld');
    expect(jsonLd?.textContent).toContain('FAQPage');
    expect(jsonLd?.textContent).toContain('What is ViralRefer?');
    expect(document.querySelectorAll('.aeo-faq-item').length).toBe(HOMEPAGE_FAQ.length);
  });

  it('initOrganicSeo skips referral landing canonical but still mounts AEO blocks', () => {
    document.body.innerHTML = `<div id="aeo-faq-list"></div>`;
    initOrganicSeo({ pathname: '/r/VIRAL-TEST01', search: '', hash: '' } as Location);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelectorAll('.aeo-faq-item').length).toBe(HOMEPAGE_FAQ.length);
  });
});
