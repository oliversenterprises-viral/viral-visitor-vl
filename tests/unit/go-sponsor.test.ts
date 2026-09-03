import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_STATIC_ROUTES } from '../../scripts/required-static-routes.mjs';

const root = resolve(import.meta.dirname, '../..');
const page = resolve(root, 'public/go/sponsor/index.html');

describe('/go/sponsor/ Featured Partner page', () => {
  it('exists as a real static file, not an SPA hole', () => {
    expect(existsSync(page)).toBe(true);
    const html = readFileSync(page, 'utf8');
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain('canonical" href="https://www.viralrefer.app/go/sponsor/"');
    expect(REQUIRED_STATIC_ROUTES.some((r) => r.url === '/go/sponsor/' && r.file === 'go/sponsor/index.html')).toBe(
      true,
    );
  });

  it('keeps the $29 / 7-day labeled slot and Site Drops door split', () => {
    const html = readFileSync(page, 'utf8');
    expect(html).toContain('Sponsored Featured Partner');
    expect(html).toContain('$29');
    expect(html).toContain('7 days');
    expect(html).toContain('not a Site Drop');
    expect(html).toContain('no cash prize');
    expect(html).toContain('Your site here');
    expect(html).toContain('--bg: #0a0a0f');
    expect(html).not.toContain('--bg: #0b0714');
    expect(html.toLowerCase()).not.toContain('cash app');
    expect(html.toLowerCase()).not.toContain('prize money');
    expect(html).not.toMatch(/30-day/i);
  });
});
