import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('live Site Drop funnel lock', () => {
  it('keeps live Site Drops copy, long UTM footer, and /guides/', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('Win the ViralRefer homepage — Site Drops + #1 banner');
    expect(html).toContain('Each step puts your site on this page. #1 owns the banner for 7 days.');
    expect(html).toContain('id="site-drops"');
    expect(html).toContain('Site Drop ladder');
    expect(html).toContain('Get my referral link');
    expect(html).toContain("You're racing.");
    expect(html).toContain('Send it now');
    expect(html).toContain('Copy link');
    expect(html).toContain('footer-link-guides');
    expect(html).toContain('href="/guides/"');
    expect(html).toContain('utm_source=homepage_footer');
    expect(html).toContain('utm_medium=internal');
    expect(html).toContain('utm_campaign=organic_tools');
    expect(html).toContain('Owner HQ');
    expect(html).toContain('style="color:#f4f4f5"');
    expect(html).toContain('vr-wordmark');
  });

  it('ships the live /guides/ hub', () => {
    const guides = readFileSync(resolve(ROOT, 'public/guides/index.html'), 'utf8');
    expect(guides).toContain('Guides · ViralRefer');
    expect(guides).toContain('/guides/site-drops/');
    expect(guides).toContain('Get my referral link');
    expect(guides).toContain('utm_source=guides');
  });
});
