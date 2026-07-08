import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_NEAR_UNLOCK_PCT,
  activitySkeletonHtml,
  communityUnlockPctLabel,
  communityUnlockStatusText,
  leaderboardSkeletonHtml,
  statsSkeletonHtml,
} from '../../src/lib/public-polish';

describe('public-polish', () => {
  it('communityUnlockStatusText escalates copy near goal', () => {
    expect(communityUnlockStatusText(0, 100)).toContain('100 more');
    expect(communityUnlockStatusText(60, 100)).toContain('Halfway there');
    expect(communityUnlockStatusText(80, 100)).toContain('Almost there');
    expect(communityUnlockStatusText(100, 100)).toContain('unlocked');
  });

  it('communityUnlockPctLabel adds urgency near threshold', () => {
    expect(communityUnlockPctLabel(10, 100)).toBe('10%');
    expect(communityUnlockPctLabel(80, 100)).toBe('80% · almost there');
    expect(communityUnlockPctLabel(100, 100)).toBe('100%');
  });

  it('COMMUNITY_NEAR_UNLOCK_PCT is 75', () => {
    expect(COMMUNITY_NEAR_UNLOCK_PCT).toBe(75);
  });

  it('skeleton helpers emit shimmer markup', () => {
    expect(leaderboardSkeletonHtml()).toContain('public-skeleton-stack');
    expect(leaderboardSkeletonHtml()).toContain('skeleton');
    expect(activitySkeletonHtml(2)).toContain('public-skeleton-stack');
    expect(statsSkeletonHtml()).toContain('grid');
  });
});