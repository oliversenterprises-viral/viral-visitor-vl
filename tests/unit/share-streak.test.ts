import { describe, it, expect, beforeEach } from 'vitest';
import {
  getShareStreakCount,
  incrementShareStreak,
  shareStreakLabel,
} from '../../src/lib/share-streak';

describe('share-streak', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at zero', () => {
    expect(getShareStreakCount()).toBe(0);
    expect(shareStreakLabel(0)).toBe('');
  });

  it('increments and persists', () => {
    expect(incrementShareStreak()).toBe(1);
    expect(incrementShareStreak()).toBe(2);
    expect(getShareStreakCount()).toBe(2);
  });

  it('shareStreakLabel escalates with count', () => {
    expect(shareStreakLabel(1)).toContain('1 share');
    expect(shareStreakLabel(4)).toContain('momentum');
    expect(shareStreakLabel(10)).toContain('on fire');
    expect(shareStreakLabel(20)).toContain('machine');
  });
});