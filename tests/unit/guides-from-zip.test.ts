import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_GUIDE_PAGES } from '../../scripts/required-static-routes.mjs';
import { LOCKED_LIVE_FUNNEL_BADGE, LOCKED_SITE_DROPS_TITLE } from '../../src/lib/site-drops-copy';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

/** Live destination. Zip is Site Drops code to match — not the product. */
describe('live /guides/ ship-quality (Site Drops English, no hung APIs)', () => {
  it('keeps exactly 21 guide HTML pages including the hub and site-drops', () => {
    expect(REQUIRED_GUIDE_PAGES).toHaveLength(21);
    expect(REQUIRED_GUIDE_PAGES[0]?.url).toBe('/guides/');
    expect(REQUIRED_GUIDE_PAGES.some((p) => p.url === '/guides/site-drops/')).toBe(true);

    for (const page of REQUIRED_GUIDE_PAGES) {
      const abs = resolve(root, 'public', page.file);
      expect(existsSync(abs), `MUST-KEEP missing: public/${page.file}`).toBe(true);
      const st = statSync(abs);
      expect(st.isFile(), `MUST-KEEP emptied: public/${page.file}`).toBe(true);
      expect(st.size, `MUST-KEEP emptied: public/${page.file} is ${st.size} bytes`).toBeGreaterThanOrEqual(500);
      const body = readFileSync(abs, 'utf8');
      expect(body).toMatch(/<!DOCTYPE html>/i);
      expect(body).toContain('<h1');
      expect(body.toLowerCase()).not.toMatch(/win cash|cash prize of|cash app payout/i);
      expect(body).not.toMatch(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*fetch\(/i);
      expect(body).not.toMatch(/supabase/i);
    }
  });

  it('serves advertised markdown alternates as real files, not the homepage SPA', () => {
    const advertised = new Set<string>();
    for (const page of REQUIRED_GUIDE_PAGES) {
      const body = read(`public/${page.file}`);
      for (const match of body.matchAll(/href="https:\/\/www\.viralrefer\.app(\/guides\/[^"]+\.md)"/g)) {
        advertised.add(match[1]);
      }
    }
    expect(advertised.size).toBeGreaterThanOrEqual(18);
    expect(advertised.has('/guides/site-drops.md')).toBe(true);
    expect(advertised.has('/guides/promoter-vs-racer.md')).toBe(true);
    expect(advertised.has('/guides/no-email-referral-loop.md')).toBe(true);
    expect(advertised.has('/guides/skill-action-not-hit.md')).toBe(true);

    const sitemap = read('public/sitemap.xml');
    for (const url of advertised) {
      const abs = resolve(root, 'public', url.replace(/^\//, ''));
      expect(existsSync(abs), `live 404/SPA: missing public${url}`).toBe(true);
      const text = readFileSync(abs, 'utf8');
      expect(text.startsWith('#')).toBe(true);
      expect(text).toContain('https://www.viralrefer.app/guides/');
      expect(text.toLowerCase()).not.toMatch(/<!doctype html>/);
      expect(sitemap).toContain(`https://www.viralrefer.app${url}`);
    }
  });

  it('serves /guides/ as a hub that links every article including site-drops', () => {
    const hub = read('public/guides/index.html');
    expect(hub).toContain('href="/guides/site-drops/"');
    expect(hub).toMatch(/<h1>\s*Guides\s*<\/h1>/);
    expect(hub.toLowerCase()).toContain('no cash prize');
    for (const page of REQUIRED_GUIDE_PAGES) {
      if (page.url === '/guides/') continue;
      expect(hub, `hub missing ${page.url}`).toContain(`href="${page.url}"`);
    }
  });

  it('keeps /guides/site-drops/ as a real Site Drop ladder page', () => {
    const html = read('public/guides/site-drops/index.html');
    expect(html).toContain('Site Drop');
    expect(html).toMatch(/<h1>\s*Site Drop ladder\s*<\/h1>/);
    expect(html).toContain('Just entered');
    expect(html).toContain('Rising');
    expect(html).toContain('no cash prize');
    expect(html).toContain('Get my referral link');
  });

  it('does not rewrite homepage English and still says Site Drop', () => {
    const html = read('index.html');
    expect(html).toContain(`<title>${LOCKED_SITE_DROPS_TITLE}</title>`);
    expect(html).toContain('Site Drop');
    expect(html).toContain(`data-i18n="funnel.badge">${LOCKED_LIVE_FUNNEL_BADGE}</span>`);
    expect(html).toContain('href="/guides/');
    expect(html).toContain('/guides/site-drops/');
    expect(LOCKED_SITE_DROPS_TITLE).toContain('Site Drop');
  });

  it('keeps the GSC verification file', () => {
    const gsc = read('public/google163d31ba24216edd.html');
    expect(gsc).toContain('google-site-verification: google163d31ba24216edd.html');
  });

  it('excludes /guides/ from the SPA catch-all so missing pages 404 instead of homepage', () => {
    const vercel = JSON.parse(read('vercel.json')) as {
      rewrites?: { source: string; destination: string }[];
    };
    const spa = vercel.rewrites?.find((r) => r.destination === '/index.html' && r.source.includes('?!' ));
    expect(spa?.source).toContain('guides/');
    expect(spa?.source).toContain('google163d31ba24216edd');
  });

  it('does not put hung-API work on first screen via the guides tree', () => {
    const guideFiles = readdirSync(resolve(root, 'public/guides'), { recursive: true }) as string[];
    for (const rel of guideFiles) {
      if (!rel.endsWith('.html')) continue;
      const body = read(`public/guides/${rel.replace(/\\/g, '/')}`);
      expect(body, rel).not.toMatch(/wqbefjzpgsezzwdrvvua\.supabase\.co/);
    }
    const llms = read('public/llms.txt');
    expect(llms).toContain('https://www.viralrefer.app/guides/');
    expect(llms).toContain('https://www.viralrefer.app/guides/site-drops/');
    expect(llms).toContain('Site Drops');
  });
});
