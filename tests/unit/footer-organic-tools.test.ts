import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { EMPTY_SLOT_META, EMPTY_SLOT_NAME } from '../../src/lib/prize-slot';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('footer Tools + Guides (organic_tools)', () => {
  it('homepage footer links Tools and Guides with utm_campaign=organic_tools', () => {
    const html = read('index.html');
    const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
    expect(footer).toContain('id="footer-link-tools"');
    expect(footer).toContain('id="footer-link-guides"');
    expect(footer).toMatch(/>Tools</);
    expect(footer).toMatch(/>Guides</);
    expect(footer).toContain('/tools/?utm_source=leadmagnet');
    expect(footer).toContain('/guides/?utm_source=leadmagnet');
    expect(footer).toContain('utm_medium=homepage_footer');
    expect(footer).toContain('utm_campaign=organic_tools');
    const toolsHref = footer.match(/id="footer-link-tools"[^>]+href="([^"]+)"/)?.[1] ?? '';
    const guidesHref = footer.match(/id="footer-link-guides"[^>]+href="([^"]+)"/)?.[1] ?? '';
    expect(toolsHref).toContain('utm_campaign=organic_tools');
    expect(guidesHref).toContain('utm_campaign=organic_tools');
  });

  it('guides hub exists and is not stolen by the SPA catch-all', () => {
    const guides = read('public/guides/index.html');
    expect(guides).toContain('Get my free referral link');
    expect(guides).toContain('Your site here');
    expect(guides).toContain('viewport-fit=cover');
    expect(guides).toContain('overflow-wrap: anywhere');
    const vercel = read('vercel.json');
    expect(vercel).toContain('guides/');
    const sitemap = read('public/sitemap.xml');
    expect(sitemap).toContain('https://www.viralrefer.app/guides/');
  });

  it('prize empty slot stays Your site here', () => {
    expect(EMPTY_SLOT_NAME).toBe('Your site here');
    expect(EMPTY_SLOT_META).toBe('Your site here · 30 days');
    const html = read('index.html');
    expect(html).toContain('Your site here');
    expect(html).toContain('Your site here · 30 days');
  });

  it('GSC verification path stays (file and/or build inject)', () => {
    const vite = read('vite.config.ts');
    expect(vite).toContain('inject-google-site-verification');
    expect(vite).toContain('google-site-verification');
    const publicDir = resolve(ROOT, 'public');
    const gscFiles = readdirSync(publicDir).filter((name) => /^google[a-z0-9_-]*\.html$/i.test(name));
    for (const name of gscFiles) {
      expect(existsSync(resolve(publicDir, name))).toBe(true);
    }
  });
});
