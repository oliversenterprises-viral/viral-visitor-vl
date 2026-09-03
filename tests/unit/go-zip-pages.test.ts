import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_STATIC_ROUTES } from '../../scripts/required-static-routes.mjs';
import { LOCKED_SITE_DROPS_TITLE } from '../../src/lib/site-drops-copy';

const root = resolve(import.meta.dirname, '../..');

/** Zip-owned /go/ doors on the Site Drops tree. */
const ZIP_GO_PAGES = [
  { url: '/go/', file: 'go/index.html', marker: '/go/affiliates/' },
  { url: '/go/adsboard/', file: 'go/adsboard/index.html', marker: '/go/adsboard/' },
  { url: '/go/affiliates/', file: 'go/affiliates/index.html', marker: 'Get my promoter link' },
  { url: '/go/challenge/', file: 'go/challenge/index.html', marker: '/go/challenge/' },
  { url: '/go/feature/', file: 'go/feature/index.html', marker: '/go/feature/' },
  { url: '/go/herculist/', file: 'go/herculist/index.html', marker: '/go/herculist/' },
  { url: '/go/makers/', file: 'go/makers/index.html', marker: '/go/makers/' },
  { url: '/go/race/', file: 'go/race/index.html', marker: '/go/race/' },
  { url: '/go/sponsor/', file: 'go/sponsor/index.html', marker: 'Sponsored Featured Partner' },
] as const;

const STATIC_FIRST_PAINT = [
  'go/index.html',
  'go/challenge/index.html',
  'go/feature/index.html',
  'go/herculist/index.html',
  'go/makers/index.html',
  'go/race/index.html',
  'go/sponsor/index.html',
] as const;

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('zip-owned /go/ splash pages', () => {
  it('keeps every owned /go/ path as a real static page (not the SPA shell)', () => {
    for (const page of ZIP_GO_PAGES) {
      const abs = resolve(root, 'public', page.file);
      expect(existsSync(abs), `MUST-KEEP missing: public/${page.file}`).toBe(true);
      expect(statSync(abs).size).toBeGreaterThan(500);
      const body = read(`public/${page.file}`);
      expect(body).toContain(page.marker);
      expect(body).toContain('<!DOCTYPE html>');
      expect(body).not.toContain('getMyReferralLinkInstant');
      expect(body).not.toContain('data-vr-ready');
      expect(body).not.toContain('\uFFFD');
    }
  });

  it('lists the owned /go/ doors on the hub and in required static routes', () => {
    const hub = read('public/go/index.html');
    const requiredUrls = REQUIRED_STATIC_ROUTES.map((r) => r.url);
    for (const page of ZIP_GO_PAGES) {
      expect(requiredUrls).toContain(page.url);
      if (page.url !== '/go/') expect(hub).toContain(page.url);
    }
  });

  it('does not edit homepage English or the GSC file', () => {
    const homepage = read('index.html');
    expect(homepage).toContain(`<title>${LOCKED_SITE_DROPS_TITLE}</title>`);
    expect(homepage).toContain('Site Drop');
    expect(homepage).toContain('SITE DROP LADDER');
    expect(read('public/google163d31ba24216edd.html')).toContain(
      'google-site-verification: google163d31ba24216edd.html',
    );
  });

  it('paints owned /go/ first screens without waiting on APIs', () => {
    for (const file of STATIC_FIRST_PAINT) {
      const body = read(`public/${file}`);
      expect(body).not.toMatch(/\bfetch\s*\(/);
    }
    const affiliates = read('public/go/affiliates/index.html');
    expect(affiliates).toContain('AbortController');
    expect(affiliates).toMatch(/abort\(\).*2000|2000.*abort/s);
    expect(affiliates).toContain('signal: ctrl.signal');
    expect(affiliates.indexOf('Get my promoter link')).toBeLessThan(affiliates.indexOf('fetch('));
  });
});
