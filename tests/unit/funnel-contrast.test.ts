import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('funnel contrast (wordmark + Message from ViralRefer)', () => {
  it('pins the header wordmark to a light color on the dark nav', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(html).toMatch(/id="vr-nav"[\s\S]*vr-wordmark[\s\S]*ViralRefer/);
    expect(css).toMatch(/#vr-nav \.vr-wordmark/);
    expect(css).toMatch(/#vr-nav \.logo-font\s*\{[^}]*color:\s*#f4f4f5/);
    expect(css).toMatch(/\.racer-talk__title[\s\S]*color:\s*#f4f4f5/);
    expect(css).toMatch(/\.vr-bc-title[\s\S]*color:\s*#f4f4f5/);
  });

  it('does not rewrite the locked send labels', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain("You're racing.");
    expect(html).toContain('Send it now');
    expect(html).toContain('Copy link');
    expect(html).toContain('Get my referral link');
    expect(html).toContain('id="referral-turnstile-container"');
  });
});
