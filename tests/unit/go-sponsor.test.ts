import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('go/sponsor Sponsored Featured Partner', () => {
  it('ships the $29 / 7-day page on this tree and keeps the contest prize slot empty', () => {
    const page = 'public/go/sponsor/index.html';
    expect(existsSync(resolve(ROOT, page))).toBe(true);
    const html = read(page);

    expect(html).toContain('canonical" href="https://www.viralrefer.app/go/sponsor/"');
    expect(html).toContain('Sponsored Featured Partner');
    expect(html).toContain('$29');
    expect(html).toContain('7 days');
    expect(html).toMatch(/EMBED_MODE=full/);
    expect(html).toContain('https://www.viralrefer.app');
    expect(html).toContain('id="sponsor-form"');
    expect(html).toContain('https://t.me/viralrefer');

    expect(html.toLowerCase()).toContain('not the contest');
    expect(html).toMatch(/no cash prize/i);
    expect(html).toMatch(/does not buy (leaderboard )?rank/i);
    expect(html).toContain('Your site here');

    expect(html).not.toMatch(/cash app/i);
    expect(html).not.toContain('ads.viralrefer.app');
    expect(html).not.toContain('848540d');

    const home = read('index.html');
    expect(home).toContain('id="prize-slot-site"');
    expect(home).toMatch(/id="prize-slot-site"[^>]*>Your site here</);
    expect(home).toContain('Your site here · 30 days');
    expect(home).not.toContain('/go/sponsor/');

    const routes = read('scripts/required-static-routes.mjs');
    expect(routes).toContain("url: '/go/sponsor/'");
    expect(routes).toContain("file: 'go/sponsor/index.html'");

    expect(read('public/sitemap.xml')).toContain('https://www.viralrefer.app/go/sponsor/');
    expect(read('api/sitemap.xml.mjs')).toContain('/go/sponsor/');
    expect(read('public/go/index.html')).toContain('/go/sponsor/');
    expect(read('public/llms.txt')).toContain('/go/sponsor/');
  });
});
