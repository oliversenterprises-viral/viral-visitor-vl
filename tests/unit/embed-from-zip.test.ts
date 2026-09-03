import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_STATIC_ROUTES } from '../../scripts/required-static-routes.mjs';

const root = resolve(import.meta.dirname, '../..');

const ZIP_EMBED_SPLASHES = [
  { url: '/embed/adsboard/', file: 'embed/adsboard/index.html' },
  { url: '/embed/challenge/', file: 'embed/challenge/index.html' },
  { url: '/embed/feature/', file: 'embed/feature/index.html' },
  { url: '/embed/herculist/', file: 'embed/herculist/index.html' },
  { url: '/embed/makers/', file: 'embed/makers/index.html' },
  { url: '/embed/race/', file: 'embed/race/index.html' },
] as const;

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('zip-owned /embed/ splash pages', () => {
  it('keeps exactly the 7 zip embed HTML pages, not the SPA shell', () => {
    const dir = resolve(root, 'public/embed');
    expect(existsSync(dir)).toBe(true);
    const htmlFiles = readdirSync(dir, { recursive: true })
      .filter((name) => String(name).endsWith('index.html'))
      .map((name) => String(name).replace(/\\/g, '/'))
      .sort();
    expect(htmlFiles).toEqual([
      'ads/index.html',
      'adsboard/index.html',
      'challenge/index.html',
      'feature/index.html',
      'herculist/index.html',
      'makers/index.html',
      'race/index.html',
    ]);

    const requiredUrls = REQUIRED_STATIC_ROUTES.map((r) => r.url);
    for (const page of ZIP_EMBED_SPLASHES) {
      const abs = resolve(root, 'public', page.file);
      expect(existsSync(abs), `MUST-KEEP missing: public/${page.file}`).toBe(true);
      expect(statSync(abs).size).toBeGreaterThan(500);
      const body = read(`public/${page.file}`);
      expect(body).toMatch(/<!DOCTYPE html>/i);
      expect(body).toContain('EMBED_MODE=embed');
      expect(body).toContain('<base target="_top"');
      expect(body).not.toContain('getMyReferralLinkInstant');
      expect(body).not.toContain('data-vr-ready');
      expect(body).not.toContain('Daily Champion');
      expect(body).not.toContain('Daily Crown');
      if (page.url !== '/embed/adsboard/') {
        expect(body).not.toMatch(/\bfetch\s*\(/);
      }
      expect(requiredUrls).toContain(page.url);
    }

    const ads = read('public/embed/ads/index.html');
    expect(statSync(resolve(root, 'public/embed/ads/index.html')).size).toBeGreaterThan(500);
    expect(ads).toContain('ads.viralrefer.app/frame.html');
    expect(ads).not.toContain('Daily Champion');
    expect(requiredUrls).toContain('/embed/ads/');
  });

  it('lists embed doors on the /go/ hub and leaves GSC alone', () => {
    const hub = read('public/go/index.html');
    expect(hub).toContain('/embed/race/');
    expect(hub).toContain('/embed/challenge/');
    expect(hub).toContain('/embed/feature/');
    expect(hub).not.toContain('/embed/sponsor');
    expect(read('public/google163d31ba24216edd.html')).toContain(
      'google-site-verification: google163d31ba24216edd.html',
    );
  });
});
