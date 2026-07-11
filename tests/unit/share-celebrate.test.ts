import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasCompetitorBadge,
  unlockCompetitorBadge,
  clearCompetitorBadgeForTests,
} from '../../src/lib/share-celebrate';

describe('share-celebrate competitor badge', () => {
  beforeEach(() => {
    clearCompetitorBadgeForTests();
  });

  it('starts locked', () => {
    expect(hasCompetitorBadge()).toBe(false);
  });

  it('unlocks once and stays unlocked', () => {
    expect(unlockCompetitorBadge()).toBe(true);
    expect(hasCompetitorBadge()).toBe(true);
    expect(unlockCompetitorBadge()).toBe(false);
    expect(hasCompetitorBadge()).toBe(true);
  });
});
