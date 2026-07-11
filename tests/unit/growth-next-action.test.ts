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

  it('daily quest nudge uses challenge-first CTA', () => {
    const a = resolveGrowthNextAction({ ...base, dailyShares: 1, shareStreak: 2, referrals: 1 });
    expect(a.headline).toMatch(/daily boost/i);
    expect(a.kind).toBe('duel_invite');
    expect(a.ctaLabel).toMatch(/challenge/i);
  });

  it('prioritizes duel invite for referred/challenge sessions', () => {
    const a = resolveGrowthNextAction({
      ...base,
      duelInviteEligible: true,
      landingRef: 'VIRAL-RIVAL',
    });
    expect(a.kind).toBe('duel_invite');
    expect(a.urgency).toBe('critical');
    expect(a.headline).toContain('VIRAL-RIVAL');
  });

  it('challenge-first for brand-new sharers', () => {
    const a = resolveGrowthNextAction({
      ...base,
      referrals: 0,
      shareStreak: 0,
      dailyShares: 0,
      gapToNext: null,
      rank: null,
    });
    expect(a.kind).toBe('duel_invite');
    expect(a.ctaLabel).toMatch(/challenge a friend/i);
  });
});