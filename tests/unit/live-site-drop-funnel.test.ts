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
    expect(html).toContain('switchAdminTab(7)');
    expect(html).toContain('aria-label="Race — this week\'s banner and text spots"');
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
