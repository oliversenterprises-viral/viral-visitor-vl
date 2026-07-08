import { describe, it, expect } from 'vitest';
import { computeVariantConversion } from '../../src/lib/share-conversion';
import type { ShareEvent } from '../../src/admin/share-analytics-helpers';

const share = (overrides: Partial<ShareEvent>): ShareEvent => ({
  platform: 'whatsapp',
  referrer_code: 'VIRAL-REAL01',
  created_at: new Date().toISOString(),
  ab_variant: 'a',
  ...overrides,
});

describe('share-conversion', () => {
  it('computes referrals per share per variant cohort', () => {
    const shares = [
      share({ referrer_code: 'VIRAL-A1', ab_variant: 'a' }),
      share({ referrer_code: 'VIRAL-A1', ab_variant: 'a' }),
      share({ referrer_code: 'VIRAL-B1', ab_variant: 'b' }),
    ];
    const counts = { 'VIRAL-A1': 4, 'VIRAL-B1': 1 };
    const summary = computeVariantConversion(shares, counts);

    const a = summary.rows.find((r) => r.variant === 'a')!;
    const b = summary.rows.find((r) => r.variant === 'b')!;
    expect(a.shareCount).toBe(2);
    expect(a.totalReferrals).toBe(4);
    expect(a.referralsPerShare).toBe(2);
    expect(b.referralsPerShare).toBe(1);
    expect(summary.leaderVariant).toBe('a');
  });

  it('excludes test share codes from cohorts', () => {
    const shares = [share({ referrer_code: 'VIRAL-SMOKETEST', ab_variant: 'a' })];
    const summary = computeVariantConversion(shares, { 'VIRAL-SMOKETEST': 9 });
    expect(summary.rows.every((r) => r.shareCount === 0)).toBe(true);
  });
});