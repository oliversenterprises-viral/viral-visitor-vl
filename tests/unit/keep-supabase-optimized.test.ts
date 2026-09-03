import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/0057_keep_desk_query_timeouts.sql'),
  'utf8',
);
const desk = readFileSync(
  resolve(import.meta.dirname, '../../supabase/functions/admin-action/index.ts'),
  'utf8',
);
const deskUi = readFileSync(
  resolve(import.meta.dirname, '../../src/admin/owner-funnel-desk.ts'),
  'utf8',
);

describe('keep Supabase optimized (desk / ladder)', () => {
  it('locks cheap last-N indexes and 2s RPC timeouts', () => {
    expect(sql).toContain('idx_visitor_events_name_created');
    expect(sql).toContain('idx_visitor_events_sitelanding_created_at');
    expect(sql).toContain('idx_visitor_events_getreferrallink_created_at');
    expect(sql).toContain('idx_referrals_created_at');
    expect(sql).toContain('idx_shares_created_at');
    expect(sql).toContain("SET statement_timeout = '2s'");
    expect(sql).toContain('get_owner_funnel_desk_counts');
    expect(sql).toContain('get_public_funnel_ticker');
    expect(sql).toContain('get_public_get_link_stats');
    expect(sql).toContain('get_leaderboard');
    expect(sql).not.toMatch(/GSC_SERVICE_ACCOUNT_JSON/);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/hero_title|Site Drop/i);
  });

  it('HQ desk stays last-N with client and per-query timeouts', () => {
    expect(desk).toMatch(/timedLast\('visitor_events', eventCols, 80, 2_000/);
    expect(desk).toMatch(/timedLast\(\s*'shares'/);
    expect(desk).toMatch(/p_limit: 40/);
    expect(desk).toMatch(/p_limit: 24/);
    expect(desk).toMatch(/limit\(14\)/);
    expect(deskUi).toMatch(/timeoutMs:\s*8_000/);
  });
});
