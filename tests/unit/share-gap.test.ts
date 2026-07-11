import { describe, it, expect } from 'vitest';
import {
  referralsToNextRank,
  formatShareGapNudge,
  buildDistanceToGlory,
} from '../../src/lib/share-gap';

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

  it('buildDistanceToGlory for #1', () => {
    const d = buildDistanceToGlory(1, null, 10);
    expect(d.tone).toBe('gold');
    expect(d.rankLabel).toBe('#1');
    expect(d.progressPercent).toBe(100);
  });

  it('buildDistanceToGlory near-win', () => {
    const d = buildDistanceToGlory(3, 1, 5);
    expect(d.tone).toBe('critical');
    expect(d.line).toMatch(/1 more/);
    expect(d.gapLabel).toBe('1');
  });

  it('buildDistanceToGlory unranked', () => {
    const d = buildDistanceToGlory(null, null, 0);
    expect(d.tone).toBe('violet');
    expect(d.line).toMatch(/first referral/i);
  });
});