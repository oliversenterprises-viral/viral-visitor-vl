import { describe, it, expect } from 'vitest';
import { computeViralPower } from '../../src/lib/viral-power';

describe('viral-power', () => {
  it('returns spark tier for new users', () => {
    const r = computeViralPower({ shareStreak: 0, referrals: 0, rank: null, gapToNext: null });
    expect(r.tier).toBe('spark');
    expect(r.score).toBeLessThan(25);
  });

  it('detects overtake rush when one referral from next rank', () => {
    const r = computeViralPower({
      shareStreak: 2,
      referrals: 4,
      rank: 3,
      gapToNext: 1,
    });
    expect(r.isOvertakeRush).toBe(true);
    expect(r.tip).toMatch(/overtaking/i);
  });

  it('reaches legend tier with strong stats', () => {
    const r = computeViralPower({
      shareStreak: 10,
      referrals: 12,
      rank: 1,
      gapToNext: null,
      dailySharesToday: 3,
    });
    expect(r.tier).toBe('legend');
    expect(r.score).toBeGreaterThanOrEqual(92);
  });
});