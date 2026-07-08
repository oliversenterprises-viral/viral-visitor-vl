import { describe, it, expect, beforeEach } from 'vitest';
import {
  setShareReferralCount,
  getShareReferralCount,
  setShareLeaderboardRank,
  getShareLeaderboardRank,
  setShareGapToNextRank,
  getShareGapToNextRank,
  isMobileShareContext,
} from '../../src/lib/share-context';

describe('share-context', () => {
  beforeEach(() => {
    setShareReferralCount(0);
  });

  it('tracks referral count for share messages', () => {
    expect(getShareReferralCount()).toBe(0);
    setShareReferralCount(5);
    expect(getShareReferralCount()).toBe(5);
    setShareReferralCount(-1);
    expect(getShareReferralCount()).toBe(0);
  });

  it('tracks leaderboard rank for share messages', () => {
    expect(getShareLeaderboardRank()).toBeNull();
    setShareLeaderboardRank(3);
    expect(getShareLeaderboardRank()).toBe(3);
    setShareLeaderboardRank(null);
    expect(getShareLeaderboardRank()).toBeNull();
  });

  it('tracks gap to next rank', () => {
    setShareGapToNextRank(3);
    expect(getShareGapToNextRank()).toBe(3);
    setShareGapToNextRank(null);
    expect(getShareGapToNextRank()).toBeNull();
  });

  it('isMobileShareContext returns boolean', () => {
    expect(typeof isMobileShareContext()).toBe('boolean');
  });
});