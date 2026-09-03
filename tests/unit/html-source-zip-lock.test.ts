import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../../src/lib/i18n/messages';
import { EXTRA_LOCALES } from '../../src/lib/i18n/extra-locales';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('zip MATCH fixture — English Site Drops for live', () => {
  it('matches zip Site Drops English on html-source and index.html (destination is live)', () => {
    const zip = read('html-source/index.html');
    const html = read('index.html');

    for (const page of [zip, html]) {
      expect(page).toContain('<title>Win the ViralRefer homepage — Site Drops + #1 banner</title>');
      expect(page).toContain('Win the homepage.');
      expect(page).toContain('Each step puts your site on this page. #1 owns the banner for 7 days.');
      expect(page).toContain(
        'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
      );
      expect(page).toContain('Your site here');
      expect(page).toContain('Your site here · 7 days');
      expect(page).toContain('Site Drop &middot; Just entered');
      expect(page).toContain('See live Site Drops');
      expect(page).toContain('SITE DROP LADDER');
      expect(page).toMatch(
        /id="recent-activity-title"[^>]*data-i18n="activity.title"[^>]*>\s*Recent Activity\s*<\/h2>/,
      );
      expect(page).not.toMatch(/>\s*Early Leaderboard\s*</);
      expect(page).not.toContain('#1 gets a banner for their site');
      expect(page).toContain('class="tail-container bg-zinc-950');
      expect(page).toContain('hero-gradient bg-zinc-950');
      expect(page).not.toContain('id="vr-lang-select"');
      expect(page).toContain('id="racer-talk"');
      expect(page).toContain('id="post-link-site-drop"');
      expect(page).toContain('id="funnel-journey-badge"');
    }
  });

  it('keeps 18 locales overlay-only and live must-keep pieces (GSC, /go/sponsor, tools)', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(18);
    expect(EXTRA_LOCALES).toHaveLength(12);
    expect(existsSync(resolve(root, 'public/google163d31ba24216edd.html'))).toBe(true);
    expect(read('public/google163d31ba24216edd.html')).toContain(
      'google-site-verification: google163d31ba24216edd.html',
    );
    expect(read('public/go/sponsor/index.html')).toContain('--bg: #0a0a0f');
    for (const slug of ['affiliates', 'challenge', 'feature', 'herculist', 'makers', 'race']) {
      expect(existsSync(resolve(root, `public/go/${slug}/index.html`))).toBe(true);
    }
    expect(existsSync(resolve(root, 'public/guides/site-drops/index.html'))).toBe(true);
    const tools = readdirSync(resolve(root, 'public/tools')).filter((name) => name.endsWith('.html'));
    expect(tools.length).toBe(39);
    expect(read('.env.example')).not.toMatch(/^VITE_ADMIN_PASSWORD=/m);
    expect(read('.env.example')).toContain('ADMIN_OWNER_PASSWORD');
  });
});
