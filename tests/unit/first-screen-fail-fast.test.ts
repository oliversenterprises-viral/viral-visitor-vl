import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCKED_SITE_DROPS_CTA, LOCKED_SITE_DROPS_TITLE } from '../../src/lib/site-drops-copy';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('first-screen fail-fast lock', () => {
  it('paints Site Drop hero and Get my link from static HTML (no API)', () => {
    const html = read('index.html');
    expect(html).toContain(`<title>${LOCKED_SITE_DROPS_TITLE}</title>`);
    expect(html).toContain('Site Drop');
    expect(html).toContain('id="hero-title"');
    expect(html).toContain('id="hero-get-link-btn"');
    expect(html).toContain(LOCKED_SITE_DROPS_CTA);
    expect(html).toContain('id="funnel-journey"');
  });

  it('does not block first paint on hung Supabase or GSC', () => {
    const main = read('src/main.ts');
    const app = read('src/app.ts');
    expect(main.indexOf('seedDefaultTextColors()')).toBeLessThan(main.indexOf('initApp()'));
    expect(main).toContain('initApp().catch(');
    expect(main).toContain("setAttribute('data-vr-ready', '1')");
    expect(app).toMatch(/const INIT_FETCH_TIMEOUT_MS = 12_000/);
    expect(app).toContain('async function withInitTimeout');
    expect(app).toContain('await withInitTimeout(loadSiteContent()');
    expect(app).toContain('await withInitTimeout(loadLeaderboard()');
    const initApp = app.slice(app.indexOf('export async function initApp()'));
    expect(initApp).not.toMatch(/await loadSiteContent\(\);/);
    expect(initApp).not.toMatch(/await loadLeaderboard\(\);/);
    expect(initApp).not.toMatch(/await fetchSiteContent\(\)/);
  });

  it('keeps /tools/ off the first-screen SPA path', () => {
    const vite = read('vite.config.ts');
    const vercel = read('vercel.json');
    expect(vite).toContain('resolvePublicStaticUrl');
    expect(vercel).toMatch(/tools\//);
    expect(read('public/tools/index.html')).toContain('Site Drop ladder');
    expect(read('public/tools/credit-checker.html')).toContain('Does this count as a referral?');
  });
});
