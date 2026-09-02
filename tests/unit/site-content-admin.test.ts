import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  isUnknownAdminAction,
  normalizeSiteContentAdminRows,
  parseGetSiteContentResult,
  SiteContentAdminError,
} from '../../src/lib/site-content-admin';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('HQ Website get_site_content path', () => {
  const src = readFileSync(resolve(ROOT, 'supabase/functions/admin-action/index.ts'), 'utf8');
  const tab = readFileSync(resolve(ROOT, 'src/admin/edit-content-tab.ts'), 'utf8');

  it('admin-action registers get_site_content before Unknown action', () => {
    const getAt = src.indexOf("action === 'get_site_content'");
    const unknownAt = src.indexOf("error: 'Unknown action'");
    expect(getAt).toBeGreaterThan(0);
    expect(unknownAt).toBeGreaterThan(getAt);
    expect(src).toMatch(/action === 'update_site_content'/);
    expect(src).toMatch(/action === 'delete_site_content'/);
    expect(src).not.toContain('reset_landing_visit_counters');
    expect(src).toContain('id: key');
  });

  it('parses { success: true, data: [{ key|id, value }] }', () => {
    const rows = parseGetSiteContentResult({
      success: true,
      data: [
        { key: 'hero_cta', value: 'Get my referral link' },
        { id: 'rules_text', value: 'Fair play' },
      ],
    });
    expect(normalizeSiteContentAdminRows(rows)).toEqual([
      { id: 'hero_cta', value: 'Get my referral link' },
      { id: 'rules_text', value: 'Fair play' },
    ]);
  });

  it('fails if the live Unknown action bug returns', () => {
    expect(isUnknownAdminAction('Unknown action')).toBe(true);
    expect(isUnknownAdminAction('Admin privileges required')).toBe(false);
    expect(() =>
      parseGetSiteContentResult({ success: false, error: 'Unknown action' }),
    ).toThrow(SiteContentAdminError);
    expect(() =>
      parseGetSiteContentResult({ success: false, error: 'Unknown action' }),
    ).toThrow(/missing get_site_content/);
  });

  it('Website tab loads get_site_content first and does not swallow Unknown action', () => {
    expect(tab).toContain("'get_site_content'");
    expect(tab).toContain('parseGetSiteContentResult');
    expect(tab).toContain('isUnknownAdminAction');
    expect(tab.indexOf('get_site_content')).toBeLessThan(tab.indexOf("from('site_content')"));
  });
});
