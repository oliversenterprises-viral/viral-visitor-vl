import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_AD_NOTE, ONE_PRIZE_SENTENCE } from '../../src/lib/prize-slot';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('five-layer first screen (Helix order)', () => {
  it('first-tap: cold land is one screen — below-fold stays hidden until expand', () => {
    const css = read('src/style.css');
    const html = read('index.html');
    expect(css).toMatch(/html:not\(\[data-vr-funnel-expanded\]\) \[data-vr-below-fold\]/);
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
    expect(hero).toContain(EXAMPLE_AD_NOTE);
    expect(hero).not.toMatch(/Free\. No email\. No cash/);
    expect(hero.toLowerCase()).not.toContain('no cash');
    expect(hero).not.toMatch(/CURRENT #1/);
  });

  it('prize pull: slot is an ad frame and the link is a pasteable tool', () => {
    const html = read('index.html');
    expect(html).toContain('Example ad');
    expect(html).toContain('viralrefer.app');
    expect(html).toContain('id="hero-ad-visit"');
    expect(html).toContain('id="hero-slot-thumb"');
    expect(html).toContain('id="hero-ad-inventory"');
    expect(html).toContain('id="hero-ad-race"');
    expect(html).toContain('https://www.viralrefer.app/tools/');
    expect(html).toContain('id="hero-slot-preview"');
    expect(html).toContain('Free growth tools');
    expect(html).toContain('Share generator');
    expect(html).toContain('id="post-link-tool"');
    expect(html).toContain('Paste it in any bio, story, or text');
    const share = read('src/lib/post-link-share.ts');
    expect(share).toContain("url.hidden = false");
    expect(share).toContain('post-link-tool');
  });
});
