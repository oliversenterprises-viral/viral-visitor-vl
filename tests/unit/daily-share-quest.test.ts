import { describe, it, expect, beforeEach } from 'vitest';
import {
  DAILY_SHARE_QUEST_GOAL,
  dailyQuestProgress,
  getDailyShareCount,
  isDailyQuestComplete,
  recordDailyShare,
} from '../../src/lib/daily-share-quest';

describe('daily-share-quest', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tracks shares toward daily goal', () => {
    expect(getDailyShareCount()).toBe(0);
    recordDailyShare();
    recordDailyShare();
    expect(getDailyShareCount()).toBe(2);
    expect(isDailyQuestComplete()).toBe(false);
    const p = dailyQuestProgress();
    expect(p.goal).toBe(DAILY_SHARE_QUEST_GOAL);
    expect(p.percent).toBe(Math.round((2 / DAILY_SHARE_QUEST_GOAL) * 100));
  });

  it('marks complete at goal shares', () => {
    for (let i = 0; i < DAILY_SHARE_QUEST_GOAL; i++) recordDailyShare();
    expect(isDailyQuestComplete()).toBe(true);
    expect(dailyQuestProgress().percent).toBe(100);
  });
});