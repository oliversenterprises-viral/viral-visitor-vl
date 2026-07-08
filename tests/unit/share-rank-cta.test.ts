import { describe, it, expect } from 'vitest';
import { buildShareRankCta } from '../../src/lib/share-rank-cta';

describe('share-rank-cta', () => {
  it('returns gold CTA for #1', () => {
    const cta = buildShareRankCta(1, 5);
    expect(cta.tone).toBe('gold');
    expect(cta.headline).toContain('#1');
    expect(cta.emphasizeBoost).toBe(true);
  });

  it('returns emerald CTA for top 3', () => {
    const cta = buildShareRankCta(2, 4);
    expect(cta.tone).toBe('emerald');
    expect(cta.headline).toContain('#2');
  });

  it('returns violet CTA when unranked with zero referrals', () => {
    const cta = buildShareRankCta(null, 0);
    expect(cta.tone).toBe('violet');
    expect(cta.headline).toContain('leaderboard');
  });

  it('returns amber CTA when referrals but no rank', () => {
    const cta = buildShareRankCta(null, 3);
    expect(cta.tone).toBe('amber');
    expect(cta.headline).toContain('3 referrals');
  });
});