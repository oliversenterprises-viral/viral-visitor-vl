import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('kid-simple first paint', () => {
  it('sets data-vr-kid-simple in <head> before the stylesheet', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const attrAt = head.indexOf("setAttribute('data-vr-kid-simple'");
    const cssAt = head.indexOf('href="/src/style.css"');
    expect(attrAt).toBeGreaterThan(0);
    expect(cssAt).toBeGreaterThan(attrAt);
    expect(head).toContain('/embed');
  });

  it('hides #prize before a link without waiting for kid-simple JS', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #prize/);
  });

  it('first screen is prize-first with one Get my free link CTA', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="daily-champion-strip"'));
    expect(hero).toMatch(/#1 gets a homepage banner/);
    expect(hero).toMatch(/for their site/);
    expect(hero).toMatch(/Tap Get my free link\. Send it\. When a friend taps Get my link, you climb/);
    expect(hero).toContain('id="hero-get-link-btn"');
    expect(hero).toContain('Get my free link');
    expect(hero).not.toMatch(/Get a free link\./);
    expect(hero).not.toContain('See leaderboard');
    expect(hero).not.toContain('id="hero-leaderboard-btn"');
    expect(hero).not.toContain('Telegram');
    expect(hero).not.toContain('id="hero-telegram-helper-btn"');
    expect(hero).not.toContain('id="hero-leaderboard-link"');
  });

  it('hides promoter chrome and unhydrated dash-proof on first viewport', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #promoter-week-strip/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\) #hero-promoter-cta/);
    expect(css).toMatch(/#vr-verified-total:not\(\.vr-verified-total--ready\)/);
  });

  it('does not paint em-dash referral proof before hydration', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const hero = html.slice(html.indexOf('id="vr-verified-total"'), html.indexOf('id="daily-champion-strip"'));
    expect(hero).not.toMatch(/—\s*verified referrals/);
    expect(hero).not.toContain('— people got a link today');
    expect(hero).toContain('id="total-referrers"');
    expect(hero).toContain('id="hero-got-link-today"');
  });
});
