import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mapSiteContentAdminRows,
  siteContentAdminEnvelope,
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
});
