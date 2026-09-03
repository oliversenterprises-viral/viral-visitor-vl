import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('all-devices layout locks', () => {
  it('first screen compresses on short phones and landscape', () => {
    const css = read('src/style.css');
    expect(css).toContain('ALL DEVICES');
    expect(css).toMatch(/@media \(max-width: 639px\)/);
    expect(css).toMatch(/@media \(max-height: 820px\)/);
    expect(css).toMatch(/@media \(max-height: 500px\) and \(min-width: 560px\)/);
    expect(css).toContain('grid-template-areas');
    expect(css).toContain('#hero-ad-visit');
    expect(css).toMatch(/#hero-ad-visit[\s\S]{0,180}min-height: 44px/);
  });

  it('hero keeps title, tools preview, prize, and CTA wrappers', () => {
    const html = read('index.html');
    expect(html).toContain('class="vr-hero-copy"');
    expect(html).toContain('class="vr-hero-action"');
    expect(html).toContain('vr-hero-ad');
    expect(html).toContain('id="hero-slot-preview"');
    expect(html).toContain('min-h-[44px] min-w-[44px]');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero.indexOf('id="hero-banner-mock"')).toBeLessThan(hero.indexOf('id="hero-get-link-btn"'));
  });

  it('dev SPA fallback does not steal /tools/ or legal pages', () => {
    const vite = read('vite.config.ts');
    expect(vite).toContain('resolvePublicStaticUrl');
    expect(vite).toContain('publicUrl');
    expect(vite).toContain('/${rel}/index.html');
  });

  it('share generator wraps long URLs instead of scrolling sideways', () => {
    const html = read('public/tools/share-generator.html');
    expect(html).toContain('overflow-wrap:anywhere');
    expect(html).toContain('overflow-x:clip');
  });

  it('legal pages use viewport-fit and wrap long words', () => {
    for (const rel of [
      'public/privacy/index.html',
      'public/terms/index.html',
      'public/rules/index.html',
      'public/guides/index.html',
    ]) {
      const html = read(rel);
      expect(html).toContain('viewport-fit=cover');
      expect(html).toContain('overflow-wrap: anywhere');
    }
  });
});
