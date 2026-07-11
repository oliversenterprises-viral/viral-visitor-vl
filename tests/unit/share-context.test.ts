import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setShareLeaderboardRank,
  getShareLeaderboardRank,
  setShareReferralCount,
  getShareReferralCount,
  setShareGapToNextRank,
  getShareGapToNextRank,
} from '../../src/lib/share-context';

describe('share-context', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-on-board');
    setShareLeaderboardRank(null);
    setShareReferralCount(0);
    setShareGapToNextRank(null);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-on-board');
    setShareLeaderboardRank(null);
  });

  it('setShareLeaderboardRank sets data-vr-on-board for quiet mode', () => {
    setShareLeaderboardRank(4);
    expect(getShareLeaderboardRank()).toBe(4);
    expect(document.documentElement.getAttribute('data-vr-on-board')).toBe('1');
  });

  it('clears data-vr-on-board when unranked', () => {
    setShareLeaderboardRank(2);
    setShareLeaderboardRank(null);
    expect(getShareLeaderboardRank()).toBeNull();
    expect(document.documentElement.hasAttribute('data-vr-on-board')).toBe(false);
  });

  it('stores referral count and gap', () => {
    setShareReferralCount(3);
    setShareGapToNextRank(2);
    expect(getShareReferralCount()).toBe(3);
    expect(getShareGapToNextRank()).toBe(2);
  });
});
