import { describe, it, expect } from 'vitest';
import { findRankOnLeaderboard, formatRankForShare } from '../../src/lib/share-rank';

describe('share-rank', () => {
  const board = [
    { referrer_code: 'VIRAL-1', referral_count: 5, rank: 1 },
    { referrer_code: 'VIRAL-2', referral_count: 3, rank: 2 },
  ];

  it('findRankOnLeaderboard matches case-insensitively', () => {
    expect(findRankOnLeaderboard('viral-2', board)).toBe(2);
    expect(findRankOnLeaderboard('VIRAL-9', board)).toBeNull();
  });

  it('formatRankForShare formats rank prefix', () => {
    expect(formatRankForShare(1)).toContain('#1');
    expect(formatRankForShare(3)).toContain('#3');
    expect(formatRankForShare(null)).toBe('');
  });
});