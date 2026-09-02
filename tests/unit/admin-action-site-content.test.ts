import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../supabase/functions/admin-action/index.ts', import.meta.url),
  'utf8',
);

describe('admin-action site content actions (Owner HQ Website tab)', () => {
  it('registers get/update/delete site_content so live HQ no longer hits Unknown action', () => {
    expect(source).toContain("action === 'get_site_content'");
    expect(source).toContain("action === 'update_site_content'");
    expect(source).toContain("action === 'delete_site_content'");
    expect(source).toMatch(/success:\s*true,\s*data:\s*rows/);
  });

  it('does not register Reset junk visits', () => {
    expect(source).not.toContain('reset_landing_visit_counters');
  });

  it('keeps existing Command / Talk / Prize / Race / Promoters actions', () => {
    expect(source).toContain("action === 'get_owner_funnel_desk'");
    expect(source).toContain("action === 'get_claims'");
    expect(source).toContain("action === 'update_claim_status'");
    expect(source).toContain("action === 'post_telegram_marketing'");
    expect(source).toContain("action === 'get_referral_counts'");
    expect(source).toContain("action === 'get_shares'");
  });
});
