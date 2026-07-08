import { describe, it, expect } from 'vitest';
import { resolveGrowthNextAction } from '../../src/lib/growth-next-action';

const base = {
  hasLink: true,
  funnelStep: 3 as number | null,
  referrals: 2,
  rank: 4,
  gapToNext: 3,
  dailyShares: 3,
  shareStreak: 5,
  isMobile: false,
  nativeShareAvailable: false,
};

describe('growth-next-action', () => {
  it('prioritizes get_link when no link', () => {
    const a = resolveGrowthNextAction({ ...base, hasLink: false });
    expect(a.kind).toBe('get_link');
  });

  it('critical urgency when one referral from overtaking', () => {
    const a = resolveGrowthNextAction({ ...base, gapToNext: 1, rank: 2 });
    expect(a.kind).toBe('whatsapp_boost');
    expect(a.urgency).toBe('critical');
  });

  it('defend #1 action', () => {
    const a = resolveGrowthNextAction({ ...base, rank: 1, gapToNext: null });
    expect(a.headline).toMatch(/defend/i);
  });

  it('daily quest nudge when under goal', () => {
    const a = resolveGrowthNextAction({ ...base, dailyShares: 1 });
    expect(a.headline).toMatch(/daily boost/i);
  });
});