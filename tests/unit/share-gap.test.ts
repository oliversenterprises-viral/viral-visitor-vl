import { describe, it, expect } from 'vitest';
import { referralsToNextRank, formatShareGapNudge } from '../../src/lib/share-gap';

const board = [
  { referrer_code: 'VIRAL-A', referral_count: 10, rank: 1 },
  { referrer_code: 'VIRAL-B', referral_count: 7, rank: 2 },
  { referrer_code: 'VIRAL-C', referral_count: 3, rank: 3 },
];

describe('share-gap', () => {
  it('returns null gap for #1', () => {
    expect(referralsToNextRank('VIRAL-A', 10, board)).toBeNull();
  });

  it('computes referrals needed to overtake above', () => {
    expect(referralsToNextRank('VIRAL-B', 7, board)).toBe(4);
    expect(referralsToNextRank('VIRAL-C', 3, board)).toBe(5);
  });

  it('formatShareGapNudge for chasing ranks', () => {
    expect(formatShareGapNudge(2, 4)).toContain('4 more referrals');
    expect(formatShareGapNudge(1, null)).toBe('');
  });
});