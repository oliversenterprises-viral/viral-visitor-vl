import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(resolve(__dirname, '../../supabase/functions/admin-action/index.ts'), 'utf8');

describe('admin-action site_content actions', () => {
  it('implements get_site_content and update_site_content after owner session checks', () => {
    const authGate = SRC.indexOf('if (!authorized)');
    const getAction = SRC.indexOf("action === 'get_site_content'");
    const updateAction = SRC.indexOf("action === 'update_site_content'");
    const unknown = SRC.lastIndexOf("error: 'Unknown action'");
    expect(authGate).toBeGreaterThan(-1);
    expect(getAction).toBeGreaterThan(authGate);
    expect(updateAction).toBeGreaterThan(authGate);
    expect(unknown).toBeGreaterThan(getAction);
    expect(SRC).toContain('Admin privileges required — re-login with owner password');
    expect(SRC).toContain('verifyAdminSessionToken');
    expect(SRC).toMatch(/select\('key, id, value, updated_at'\)/);
  });

  it('does not add reset_landing_visit_counters as a handled action', () => {
    expect(SRC).not.toMatch(/action === ['"]reset_landing_visit_counters['"]/);
  });

  it('does not treat get_site_content as a public unauthenticated action', () => {
    const verifyPassword = SRC.indexOf("action === 'verify_owner_password'");
    const getAction = SRC.indexOf("action === 'get_site_content'");
    const authorizedBlockEnd = SRC.indexOf('const supabaseAdmin = createClient');
    expect(verifyPassword).toBeGreaterThan(-1);
    expect(getAction).toBeGreaterThan(authorizedBlockEnd);
  });
});
