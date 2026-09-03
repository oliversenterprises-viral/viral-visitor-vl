import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_GUIDE_PAGES } from '../../scripts/required-static-routes.mjs';
import { LOCKED_SITE_DROPS_TITLE } from '../../src/lib/site-drops-copy';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('public/guides restored from the owner Site Drops HTML zip', () => {
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
});
