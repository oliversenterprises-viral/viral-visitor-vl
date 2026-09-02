import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('funnel contrast (wordmark + Message from ViralRefer)', () => {
  it('pins the header wordmark to a light color on the dark nav', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(html).toMatch(/id="vr-nav"[\s\S]*vr-wordmark[\s\S]*style="color:#f4f4f5"[\s\S]*ViralRefer/);
    expect(css).toMatch(/#vr-nav \.vr-wordmark/);
    expect(css).toMatch(/#vr-nav \.logo-font\s*\{[^}]*color:\s*#f4f4f5\s*!important/);
    expect(html).toContain('Tap Get my link. Send it. When a friend taps Get my link, you climb.');
    expect(css).toMatch(/\.racer-talk__title[\s\S]*color:\s*#f4f4f5/);
    expect(css).toMatch(/\.vr-bc-title[\s\S]*color:\s*#f4f4f5/);
  });

  it('keeps send labels and Get my referral link', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain("You're racing.");
    expect(html).toContain('Send it now');
    expect(html).toContain('Copy link');
    expect(html).toContain('Get my referral link');
    expect(html).toContain('id="referral-turnstile-container"');
  });

  it('Site Drop title uses an ASCII-safe middle dot', () => {
    const raw = readFileSync(resolve(ROOT, 'index.html'));
    const html = raw.toString('utf8');
    expect(html).toContain('Site Drop &middot; Just entered');
    expect(html).not.toMatch(/Site Drop \uFFFD Just entered/);
  });
});
