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

  it('one action after link: WhatsApp when native is unavailable', () => {
    const a = resolveGrowthNextAction({ ...base, gapToNext: 1, rank: 2 });
    expect(a.kind).toBe('whatsapp_boost');
    expect(a.urgency).toBe('critical');
    expect(a.subline).toMatch(/Get my link/i);
  });

  it('one action after link: native share when available', () => {
    const a = resolveGrowthNextAction({ ...base, nativeShareAvailable: true, isMobile: true });
    expect(a.kind).toBe('native_share');
    expect(a.ctaLabel).toMatch(/share now/i);
    expect(a.subline).toMatch(/Get my link/i);
  });

  it('defend #1 still uses the single share action', () => {
    const a = resolveGrowthNextAction({ ...base, rank: 1, gapToNext: null });
    expect(a.headline).toMatch(/defend/i);
    expect(a.kind).toBe('whatsapp_boost');
  });

  it('daily quest nudge stays on the single share action', () => {
    const a = resolveGrowthNextAction({ ...base, dailyShares: 1, shareStreak: 2, referrals: 1 });
    expect(a.headline).toMatch(/daily boost/i);
    expect(['native_share', 'whatsapp_boost']).toContain(a.kind);
  });

  it('referred sessions still use one share action, not a duel command center', () => {
    const a = resolveGrowthNextAction({
      ...base,
      duelInviteEligible: true,
      landingRef: 'VIRAL-RIVAL',
    });
    expect(a.kind).toBe('whatsapp_boost');
    expect(a.subline).toMatch(/Get my link/i);
  });

  it('brand-new sharers get WhatsApp, not a challenge wall', () => {
    const a = resolveGrowthNextAction({
      ...base,
      referrals: 0,
      shareStreak: 0,
      dailyShares: 0,
      gapToNext: null,
      rank: null,
    });
    expect(a.kind).toBe('whatsapp_boost');
    expect(a.ctaLabel).toMatch(/whatsapp/i);
  });
});
