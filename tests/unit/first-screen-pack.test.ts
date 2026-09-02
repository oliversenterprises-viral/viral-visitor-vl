import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('first-screen pack (locked Site Drops page)', () => {
  const html = read('index.html');
  const css = read('src/style.css');
  const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));

  it('keeps locked live Site Drops homepage copy', () => {
    expect(hero).toContain('Win the homepage.');
    expect(hero).toContain('Each step puts your site on this page. #1 owns the banner for 7 days.');
    expect(hero).toContain(
      'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
    );
    expect(hero).toContain('Get my referral link');
    expect(hero).toContain(
      'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.',
    );
    expect(hero).toContain('Empty right now. #1 this week puts their site here.');
    expect(hero).not.toContain('#1 gets a banner for their site.');
    expect(hero).not.toContain('Verified #1 gets a 30-day banner for their website.');
    expect(hero).not.toContain('Example — this is what #1 gets');
  });

  it('puts Get my link in the first view and hides extra slot lines on first paint', () => {
    expect(hero).toContain('id="hero-get-link-btn"');
    expect(html).toMatch(/id="hero-ad-inventory"[^>]*\bhidden\b/);
    expect(html).toMatch(/id="hero-ad-race"[^>]*\bhidden\b/);
    expect(hero).not.toMatch(/Seen \d/);
    expect(hero).not.toMatch(/of 10 friends/);
    expect(css).toMatch(
      /html:not\(\[data-vr-has-link\]\) #hero-ad-inventory,\s*html:not\(\[data-vr-has-link\]\) #hero-ad-race/,
    );
    expect(css).toContain('#hero-get-link-btn');
    expect(css).toMatch(/@media \(max-height: 820px\)/);
  });

  it('pins a readable wordmark', () => {
    expect(html).toContain('class="vr-wordmark');
    expect(html).toContain('style="color:#f4f4f5"');
    expect(css).toContain('#vr-nav .vr-wordmark');
    expect(css).toContain('color: #f4f4f5 !important');
  });

  it('does not hydrate extra slot lines before Get my link', () => {
    const pull = read('src/lib/prize-pull.ts');
    expect(pull).toContain("hasAttribute('data-vr-has-link')");
    expect(pull).toMatch(/if \(typeof document !== 'undefined' && !document\.documentElement\.hasAttribute\('data-vr-has-link'\)\)/);
  });

  it('does not CSS-hide How, Board, or footer on the public page', () => {
    expect(html).toContain('id="how"');
    expect(html).toContain('id="leaderboard"');
    expect(html).toContain('<footer');
    expect(css).toMatch(/html:not\(\[data-vr-embed\]\) #how/);
    expect(css).toMatch(/html:not\(\[data-vr-embed\]\) #leaderboard/);
    expect(css).toMatch(/html:not\(\[data-vr-embed\]\) footer/);
    expect(css).toContain('display: block !important');
    expect(css).toMatch(
      /\[data-vr-below-fold\]:not\(#how\):not\(#leaderboard\)/,
    );
  });
});
