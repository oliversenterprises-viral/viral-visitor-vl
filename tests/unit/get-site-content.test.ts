import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContentListHTML } from '../../src/admin/edit-content-tab';
import {
  isSiteContentActionMissing,
  mapSiteContentAdminRows,
  resolveWebsiteTabLoad,
  siteContentAdminEnvelope,
  websiteTabLooksLikeEmptyCms,
  websiteTabUnknownActionBanner,
} from '../../src/lib/site-content-admin';

const root = resolve(import.meta.dirname, '../..');

describe('get_site_content (HQ Website tab)', () => {
  it('admin-action implements get_site_content and keeps update/delete', () => {
    const src = readFileSync(resolve(root, 'supabase/functions/admin-action/index.ts'), 'utf8');
    expect(src).toContain("action === 'get_site_content'");
    expect(src).toContain("action === 'update_site_content'");
    expect(src).toContain("action === 'delete_site_content'");
    expect(src).not.toContain('reset_landing_visit_counters');
    expect(src).toMatch(/success:\s*true,\s*data:\s*rows/);
    expect(src).toMatch(/key:\s*key/);
    expect(src).toMatch(/id:\s*key/);
    expect(src).toMatch(/value:\s*row\.value/);
  });

  it('Website tab loads via get_site_content first', () => {
    const src = readFileSync(resolve(root, 'src/admin/edit-content-tab.ts'), 'utf8');
    expect(src).toContain("invokeAdminAction<unknown>('get_site_content')");
    expect(src).toContain('mapSiteContentAdminRows');
    expect(src).toContain("invokeAdminAction('update_site_content'");
    expect(src).toContain("invokeAdminAction('delete_site_content'");
    expect(src).not.toContain('reset_landing_visit_counters');
  });

  it('maps {key|id, value} rows the Website tab expects', () => {
    const rows = mapSiteContentAdminRows([
      { key: 'hero_title', value: 'Win the homepage.' },
      { id: 'cta_button_text', value: 'Get my referral link' },
      { key: '', value: 'skip' },
    ]);
    expect(rows).toEqual([
      {
        key: 'cta_button_text',
        id: 'cta_button_text',
        value: 'Get my referral link',
        description: null,
        updated_at: null,
      },
      {
        key: 'hero_title',
        id: 'hero_title',
        value: 'Win the homepage.',
        description: null,
        updated_at: null,
      },
    ]);
    expect(siteContentAdminEnvelope(rows)).toEqual({ success: true, data: rows });
  });

  it('detects Unknown action / FunctionsHttpError as a missing get_site_content', () => {
    expect(isSiteContentActionMissing('Unknown action')).toBe(true);
    expect(isSiteContentActionMissing('FunctionsHttpError: Edge Function returned a non-2xx status code')).toBe(true);
    expect(isSiteContentActionMissing('get_site_content is not found')).toBe(true);
    expect(isSiteContentActionMissing('RLS denied')).toBe(false);
    expect(isSiteContentActionMissing('')).toBe(false);
  });

  it('Unknown action with public rows is a warning, not an empty store', () => {
    const load = resolveWebsiteTabLoad({
      adminResult: { success: false, error: 'Unknown action' },
      publicRows: [{ key: 'hero_title', value: 'Win the homepage.' }],
    });
    expect(load.via).toBe('public_select');
    expect(load.actionMissing).toBe(true);
    expect(load.rows).toHaveLength(1);
    expect(websiteTabUnknownActionBanner(load)).toMatch(/not an empty site/);
    expect(websiteTabUnknownActionBanner(load)).toMatch(/Talk and Prize still load/);
  });

  it('Unknown action with zero rows still is not an empty CMS paint', () => {
    const load = resolveWebsiteTabLoad({
      adminResult: { success: false, error: 'Unknown action' },
      publicRows: [],
    });
    expect(load.via).toBe('none');
    expect(load.actionMissing).toBe(true);
    const html = buildContentListHTML(load.rows, load);
    expect(html).toContain('data-hq-talk="1"');
    expect(html).toContain('> Talk');
    expect(html).toContain('id="owner-broadcast-panel"');
    expect(html).toContain('data-hq-website-action-missing="1"');
    expect(html).toContain('Website is not an empty CMS');
    expect(html).toContain('data-hq-website-not-empty="1"');
    expect(html).not.toContain('No content entries yet.');
    expect(html).not.toMatch(/Error loading content/i);
    expect(websiteTabLooksLikeEmptyCms(html)).toBe(false);
    expect(websiteTabLooksLikeEmptyCms('Error loading content: Unknown action')).toBe(true);
  });

  it('Website tab still paints Talk chrome when get_site_content succeeds', () => {
    const load = resolveWebsiteTabLoad({
      adminResult: {
        success: true,
        data: [{ key: 'owner_broadcast_title', value: 'Hello joiners' }],
      },
    });
    expect(load.via).toBe('get_site_content');
    expect(load.actionMissing).toBe(false);
    const html = buildContentListHTML(load.rows, load);
    expect(html).toContain('data-hq-talk="1"');
    expect(html).not.toContain('data-hq-website-action-missing="1"');
    expect(websiteTabLooksLikeEmptyCms(html)).toBe(false);
  });

  it('Prize and Talk stay wired independently of get_site_content', () => {
    const website = readFileSync(resolve(root, 'src/admin/edit-content-tab.ts'), 'utf8');
    const switcher = readFileSync(resolve(root, 'src/admin/switcher.ts'), 'utf8');
    const prize = readFileSync(resolve(root, 'src/admin/prize-claims-tab.ts'), 'utf8');
    expect(website).toContain('data-hq-talk="1"');
    expect(website).toContain('id="owner-broadcast-panel"');
    expect(website).toContain('buildContentListHTML([], loaded)');
    expect(website).not.toMatch(/innerHTML\s*=\s*[`'"][^`'"]*Error loading content/);
    expect(switcher).toContain('await renderPrizeClaimsTab(content)');
    expect(switcher).toContain('tab === 3');
    expect(prize).toContain('data-hq-prize="1"');
    expect(prize).toContain('export async function renderPrizeClaimsTab');
    expect(prize).toContain("invokeAdminAction<AdminClaimRow[]>('get_claims')");
    const promoters = readFileSync(resolve(root, 'src/admin/affiliates-tab.ts'), 'utf8');
    expect(promoters).toContain('data-hq-promoters="1"');
    expect(promoters).toContain('Still paint Promoters chrome');
    expect(switcher).toContain('renderAffiliatesTab');
  });
});
