import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('live Site Drop funnel lock', () => {
  it('keeps live Site Drops copy, long UTM footer, and /guides/', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const i18n = readFileSync(resolve(ROOT, 'src/lib/i18n/messages.ts'), 'utf8');
    expect(html).toContain('<title>Win the ViralRefer homepage — Site Drops + #1 banner</title>');
    expect(html).toContain('Each step puts your site on this page. #1 owns the banner for 7 days.');
    expect(html).toContain(
      'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
    );
    expect(html).toContain('Empty right now. #1 this week puts their site here.');
    expect(html).toContain(
      'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.',
    );
    expect(html).not.toContain('Win the ViralRefer homepage — #1 gets a banner');
    expect(html).not.toContain('#1 gets a banner for their site.');
    expect(i18n).toContain("'hero.title_accent': 'Each step puts your site on this page. #1 owns the banner for 7 days.'");
    expect(i18n).not.toContain('#1 gets a banner for their site.');
    expect(html).toContain('id="site-drops"');
    expect(html).toContain('Site Drop ladder');
    expect(html).toContain('Get my referral link');
    expect(html).toContain("You're racing.");
    expect(html).toContain('Send it now');
    expect(html).toContain('Copy link');
    expect(html).toContain('footer-link-guides');
    expect(html).toContain('href="/guides/"');
    expect(html).toContain('href="/rules/"');
    expect(html).toContain('href="/privacy/"');
    expect(html).toContain('href="/terms/"');
    expect(html).toContain('href="/tools/"');
    expect(html).toContain('utm_source=homepage_footer');
    expect(html).toContain('/tools/credit-checker.html?utm_source=homepage_footer');
    expect(html).toContain('/tools/what-to-paste.html?utm_source=homepage_footer');
    expect(html).toContain('href="/llms.txt"');
    expect(html).toContain('href="/go/affiliates/"');
    expect(html).toContain('href="/go/sponsor/"');
    expect(html).toContain('https://fazier.com/api/v1/public/badges/launch_badges.svg');
    expect(html).not.toContain('https://fazier.com/api/v1//public/badges');
    expect(html).toMatch(/<img id="hero-slot-thumb"[^>]*src="data:image\/gif;base64,/);
    expect(html).toMatch(/<img id="prize-slot-thumb"[^>]*src="data:image\/gif;base64,/);
    expect(html).not.toMatch(/<img id="hero-slot-thumb"[^>]*src=""/);
    expect(html).not.toMatch(/<img id="prize-slot-thumb"[^>]*src=""/);
    expect(html).toContain('utm_medium=internal');
    expect(html).toContain('utm_campaign=organic_tools');
    expect(html).toContain('Owner HQ');
    expect(html).toContain('style="color:#f4f4f5"');
    expect(html).toContain('vr-wordmark');
    expect(html).toContain('switchAdminTab(7)');
    expect(html).toContain('aria-label="Race — this week\'s banner and text spots"');
  });

  it('never auto-opens Don\'t-leave on the post-get-link send screen', () => {
    const rescue = readFileSync(resolve(ROOT, 'src/lib/share-abandon-rescue.ts'), 'utf8');
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(rescue).not.toMatch(/tryShow\('dwell'/);
    expect(rescue).not.toMatch(/tryShow\('poll'/);
    expect(rescue).not.toMatch(/tryShow\('return'/);
    expect(rescue).not.toMatch(/setTimeout\(\(\) => tryShow/);
    expect(rescue).toContain("tryShow('exit'");
    expect(rescue).toContain('isAutoOpenShareAbandonReason');
    expect(rescue).toContain('vr-share-abandon--send-safe');
    expect(css).toContain('vr-share-abandon--send-safe');
    expect(css).toMatch(/html\[data-vr-post-link-one\] \.vr-share-abandon/);
    expect(css).toMatch(/html\[data-vr-share-abandon\] #post-link-copy/);
    expect(css).toMatch(/html\[data-vr-share-abandon\] #post-link-primary/);
  });

  it('keeps owner HQ site_content actions that live JS still calls', () => {
    const edge = readFileSync(resolve(ROOT, 'supabase/functions/admin-action/index.ts'), 'utf8');
    const client = readFileSync(resolve(ROOT, 'src/lib/admin-site-content.ts'), 'utf8');
    const website = readFileSync(resolve(ROOT, 'src/admin/edit-content-tab.ts'), 'utf8');
    const promoters = readFileSync(resolve(ROOT, 'src/admin/affiliates-tab.ts'), 'utf8');
    const race = readFileSync(resolve(ROOT, 'src/admin/race-desk.ts'), 'utf8');
    expect(edge).toContain("action === 'get_site_content'");
    expect(edge).toContain("action === 'update_site_content'");
    expect(edge).not.toMatch(/action === ['"]reset_landing_visit_counters['"]/);
    expect(client).toContain("'get_site_content'");
    expect(website).toContain('fetchAdminSiteContentRows');
    expect(promoters).toContain('fetchAdminSiteContent');
    expect(race).toContain('fetchAdminSiteContent');
    expect(race).toContain('update_site_content');
  });

  it('ships the live /guides/ hub', () => {
    const guides = readFileSync(resolve(ROOT, 'public/guides/index.html'), 'utf8');
    expect(guides).toContain('Guides · ViralRefer');
    expect(guides).toContain('/guides/site-drops/');
    expect(guides).toContain('Get my referral link');
    expect(guides).toContain('utm_source=guides');
  });
});
