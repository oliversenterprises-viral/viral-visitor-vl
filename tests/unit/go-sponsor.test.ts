import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_STATIC_ROUTES } from '../../scripts/required-static-routes.mjs';

const root = resolve(import.meta.dirname, '../..');
const page = resolve(root, 'public/go/sponsor/index.html');
const thanks = resolve(root, 'public/go/sponsor/thanks/index.html');
const gsc = resolve(root, 'public/google163d31ba24216edd.html');

describe('/go/sponsor/ Featured Partner page', () => {
  it('exists as a real static file, not an SPA hole', () => {
    expect(existsSync(page)).toBe(true);
    const html = readFileSync(page, 'utf8');
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain('<title>Sponsored Featured Partner · $29 / 7 days</title>');
    expect(html).toContain('--bg: #0a0a0f');
    expect(html).toContain('canonical" href="https://www.viralrefer.app/go/sponsor/"');
    expect(REQUIRED_STATIC_ROUTES.some((r) => r.url === '/go/sponsor/' && r.file === 'go/sponsor/index.html')).toBe(
      true,
    );
  });

  it('keeps the $29 / 7-day labeled slot separate from the Site Drop ladder', () => {
    const html = readFileSync(page, 'utf8');
    expect(html).toContain('Sponsored Featured Partner');
    expect(html).toContain('$29');
    expect(html).toContain('7 days');
    expect(html).toContain('Labeled paid slot');
    expect(html).toContain('not a Site Drop');
    expect(html).toContain('Site Drop ladder');
    expect(html).toContain('no cash prize');
    expect(html).toContain('Your site here');
    expect(html).toContain('/go/sponsor/thanks/');
    expect(html.toLowerCase()).not.toContain('cash app');
    expect(html.toLowerCase()).not.toContain('prize money');
    expect(html).not.toMatch(/30-day/i);
  });

  it('ships /go/sponsor/thanks/ and leaves homepage English + GSC alone', () => {
    expect(existsSync(thanks)).toBe(true);
    const thanksHtml = readFileSync(thanks, 'utf8');
    expect(thanksHtml).toContain('--bg: #0a0a0f');
    expect(thanksHtml).toContain('Sponsored Featured Partner');
    expect(thanksHtml).toContain('not a Site Drop');
    expect(thanksHtml).toContain('$29 / 7 days');
    expect(REQUIRED_STATIC_ROUTES.some((r) => r.url === '/go/sponsor/thanks/')).toBe(true);

    const home = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(home).toContain('Site Drop');
    expect(home).toContain('<title>Win the ViralRefer homepage — Site Drops + #1 banner</title>');

    expect(existsSync(gsc)).toBe(true);
    expect(readFileSync(gsc, 'utf8')).toContain('google-site-verification: google163d31ba24216edd.html');
  });
});
