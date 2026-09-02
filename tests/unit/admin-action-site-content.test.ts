import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('admin-action site_content (Owner HQ Website tab)', () => {
  const src = readFileSync(resolve(ROOT, 'supabase/functions/admin-action/index.ts'), 'utf8');
  const tab = readFileSync(resolve(ROOT, 'src/admin/edit-content-tab.ts'), 'utf8');

  it('registers get_site_content and keeps update/delete', () => {
    expect(src).toMatch(/action === 'get_site_content'/);
    expect(src).toMatch(/action === 'update_site_content'/);
    expect(src).toMatch(/action === 'delete_site_content'/);
    expect(src).toContain(".from('site_content')");
    expect(src).toContain(".select('key, value, updated_at')");
  });

  it('does not add reset_landing_visit_counters', () => {
    expect(src).not.toContain('reset_landing_visit_counters');
  });

  it('Website tab loads rows through get_site_content', () => {
    expect(tab).toContain("invokeAdminAction");
    expect(tab).toContain("'get_site_content'");
    expect(tab).toContain('fetchSiteContentRows');
  });
});
