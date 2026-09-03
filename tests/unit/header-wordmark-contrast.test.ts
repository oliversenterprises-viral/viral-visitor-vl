import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('header wordmark contrast on black homepage', () => {
  it('pins ViralRefer to a light color so it is readable on #0a0a0f', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');

    expect(html).toMatch(/id="vr-nav"[\s\S]*vr-wordmark[\s\S]*style="color:#f4f4f5"[\s\S]*ViralRefer/);
    expect(css).toMatch(/#vr-nav \.vr-wordmark/);
    expect(css).toMatch(/#vr-nav \.logo-font\s*\{[^}]*color:\s*#f4f4f5\s*!important/);
  });

  it('does not rewrite the black page or hero-gradient', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    const bodyBlock = css.match(/body\s*\{[^}]+\}/);
    expect(bodyBlock?.[0]).toMatch(/background:\s*#0a0a0f/);

    const heroBlock = css.match(/\.hero-gradient\s*\{[^}]+\}/);
    expect(heroBlock?.[0]).toMatch(/#0a0a12/);
    expect(heroBlock?.[0]).not.toMatch(/background:\s*#0{3,6}\b/);
    expect(heroBlock?.[0]).not.toMatch(/#2563eb|#1d4ed8|#3b82f6|#1e40af/);
  });
});
