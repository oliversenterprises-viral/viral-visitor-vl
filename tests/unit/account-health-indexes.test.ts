import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/0057_account_health_scan_caps.sql'),
  'utf8',
);

describe('0057 account health scan caps', () => {
  it('adds last-N indexes for SiteLanding / GetReferralLink and created_at on shares/referrals', () => {
    expect(sql).toContain('idx_visitor_events_name_created');
    expect(sql).toContain('(event_name, created_at DESC)');
    expect(sql).toContain('idx_visitor_events_sitelanding_created_at');
    expect(sql).toContain("WHERE event_name = 'SiteLanding'");
    expect(sql).toContain('idx_visitor_events_getreferrallink_created_at');
    expect(sql).toContain("WHERE event_name = 'GetReferralLink'");
    expect(sql).toContain('idx_shares_created_at');
    expect(sql).toContain('idx_shares_created_at_desc');
    expect(sql).toContain('idx_referrals_created_at');
    expect(sql).toMatch(/ON public\.shares \(created_at DESC\)/);
    expect(sql).toMatch(/ON public\.referrals \(created_at DESC\)/);
  });

  it('caps get_owner_funnel_desk_counts and get_public_funnel_ticker with timeout and LIMIT', () => {
    expect(sql).toContain('get_owner_funnel_desk_counts');
    expect(sql).toContain('get_public_funnel_ticker');
    expect(sql).toMatch(/SET statement_timeout = '2s'/);
    expect(sql).toContain('LIMIT 4000');
    expect(sql).toContain('LIMIT 2000');
    expect(sql).toContain('LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48)');
    expect(sql).toMatch(/cannot sequential-scan/i);
  });

  it('does not drop data or GSC verify objects', () => {
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.(referrals|visitor_events|shares)/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toContain('google163d31ba24216edd');
    expect(sql).not.toMatch(/search.?console/i);
  });
});
