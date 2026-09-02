import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { EMPTY_AD_NOTE, ONE_PRIZE_SENTENCE } from '../../src/lib/prize-slot';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('five-layer first screen (Helix order)', () => {
  it('first-tap: public homepage shows How / Feature / Board; referred and embed still hide below-fold', () => {
    const css = read('src/style.css');
    const html = read('index.html');
    expect(css).toMatch(
      /html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\):not\(\[data-vr-funnel-expanded\]\) \[data-vr-below-fold\]/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\):not\(\[data-vr-has-link\]\) #how/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\):not\(\[data-vr-has-link\]\) #prize/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\):not\(\[data-vr-has-link\]\) #leaderboard/,
    );
    expect(css).toMatch(/html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\) footer/);
    expect(css).toMatch(/html:not\(\[data-vr-has-link\]\):not\(\[data-vr-referred-micro\]\) #funnel-expand-wrap/);
    expect(html).toContain('id="funnel-expand-btn"');
    expect(html).toContain('id="hero-get-link-btn"');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero.indexOf('id="hero-banner-mock"')).toBeLessThan(hero.indexOf('id="hero-get-link-btn"'));
    expect(hero.indexOf('id="hero-prize-one"')).toBeLessThan(hero.indexOf('id="hero-get-link-btn"'));
  });

  it('loop: after Get my link the only job is send', () => {
    const css = read('src/style.css');
    expect(css).toMatch(/html\[data-vr-has-link\] #hero-get-link-btn/);
    expect(css).toMatch(/html\[data-vr-has-link\] #funnel-expand-wrap/);
    expect(css).toMatch(/html\[data-vr-has-link\] \[data-vr-below-fold\]/);
    expect(css).toMatch(
      /html\[data-vr-has-link\] #hero-banner-mock,\s*html\[data-vr-post-link-one\] #hero-banner-mock/,
    );
    expect(css).toMatch(/html\[data-vr-has-link\] #hero-telegram-helper-btn/);
    expect(css).toMatch(/html\[data-vr-has-link\] #hero-leaderboard-btn/);
    expect(css).not.toMatch(/html\[data-vr-has-link\] #hero-telegram-helper-btn \{\s*display: flex;/);
  });

  it('trust: first screen says the prize once and does not chant no-cash', () => {
    const html = read('index.html');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).toContain(ONE_PRIZE_SENTENCE);
    expect(hero).toContain(EMPTY_AD_NOTE);
    expect(hero).not.toMatch(/Free\. No email\. No cash/);
    expect(hero.toLowerCase()).not.toContain('no cash');
    expect(hero).not.toMatch(/CURRENT #1/);
  });

  it('prize pull: empty slot on first paint, pasteable link after Get my link', () => {
    const html = read('index.html');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).toContain('Empty right now. #1 this week puts their site here.');
    expect(hero).toContain('viralrefer.app');
    expect(hero).toContain('id="hero-ad-visit"');
    expect(hero).toContain('id="hero-slot-thumb"');
    expect(hero).toContain('id="hero-ad-inventory"');
    expect(hero).toContain('id="hero-ad-race"');
    expect(hero).toContain('id="hero-slot-preview"');
    expect(hero).not.toContain('Example ad');
    expect(hero).not.toContain('Free growth tools');
    expect(html).toContain('id="post-link-tool"');
    expect(html).toContain('Paste it in any bio, story, or text');
    const share = read('src/lib/post-link-share.ts');
    expect(share).toContain("url.hidden = false");
    expect(share).toContain('post-link-tool');
  });
});
