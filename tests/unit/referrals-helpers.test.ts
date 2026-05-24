import { describe, it, expect } from 'vitest';
import { computeHighRiskIPs, filterReferralsByDays } from '../../src/admin/referrals-tab';
import type { AdminReferralRow } from '../../src/admin/state';

const makeRow = (overrides: Partial<AdminReferralRow> = {}): AdminReferralRow => ({
  referrer_code: 'TEST',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('referrals helpers (pure)', () => {
  it('computeHighRiskIPs detects IPs with 3+ referrals', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '5.6.7.8' }),
    ];

    const risk = computeHighRiskIPs(rows);
    expect(risk.has('1.2.3.4')).toBe(true);
    expect(risk.has('5.6.7.8')).toBe(false);
  });

  it('filterReferralsByDays returns all when days=0', () => {
    const rows = [makeRow(), makeRow()];
    const filtered = filterReferralsByDays(rows, 0);
    expect(filtered.length).toBe(2);
  });

  it('filterReferralsByDays correctly filters recent rows', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const rows: AdminReferralRow[] = [
      makeRow({ created_at: now.toISOString() }),
      makeRow({ created_at: twoDaysAgo }),
      makeRow({ created_at: tenDaysAgo }),
    ];

    const last3Days = filterReferralsByDays(rows, 3);
    expect(last3Days.length).toBe(2);
  });

  it('computeHighRiskIPs returns empty set when no high-risk IPs', () => {
    const rows: AdminReferralRow[] = [
      makeRow({ ip_address: '1.2.3.4' }),
      makeRow({ ip_address: '5.6.7.8' }),
    ];
    const risk = computeHighRiskIPs(rows);
    expect(risk.size).toBe(0);
  });

  it('filterReferralsByDays filters correctly for various day ranges', () => {
    const now = new Date();
    const rows: AdminReferralRow[] = [
      makeRow({ created_at: now.toISOString() }),
      makeRow({ created_at: new Date(now.getTime() - 5 * 86400000).toISOString() }),
    ];

    expect(filterReferralsByDays(rows, 1).length).toBe(1);
    expect(filterReferralsByDays(rows, 10).length).toBe(2);
  });
});
