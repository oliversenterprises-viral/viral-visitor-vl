import { describe, expect, it } from 'vitest';
import {
  burstTier,
  celebrationLine,
  formatDiesIn,
  ghostCount,
  microGoal,
  normalizeStreak,
  progressPct,
  raceGap,
  risingHook,
  shareStreakLabel,
  utcWeekEndMs,
  weekClockLabel,
} from '../src/game';

const noon = Date.parse('2026-09-12T12:00:00.000Z');
const late = Date.parse('2026-09-12T22:30:00.000Z');

describe('burstTier + celebration lines', () => {
  it('scales confetti by credits / unlock', () => {
    expect(burstTier(1, false)).toBe('spark');
    expect(burstTier(2, false)).toBe('burst');
    expect(burstTier(3, false)).toBe('storm');
    expect(burstTier(1, true)).toBe('storm');
  });

  it('rotates real-host lines and names unlocks', () => {
    expect(celebrationLine(1, 'alpha.test')).toContain('alpha.test');
    expect(celebrationLine(1, 'alpha.test', 'Rising')).toBe(
      'alpha.test unlocked Rising. Share this rung while it is hot.',
    );
  });
});

describe('share streak', () => {
  it('resets after a missed day and marks dying in the last 4h', () => {
    const alive = normalizeStreak({ days: 3, lastDay: '2026-09-12', lastAt: noon }, noon);
    expect(alive.days).toBe(3);
    expect(alive.dying).toBe(false);

    const dying = normalizeStreak({ days: 4, lastDay: '2026-09-11', lastAt: noon - 86_400_000 }, late);
    expect(dying.days).toBe(4);
    expect(dying.dying).toBe(true);
    expect(dying.diesInMs).toBeLessThanOrEqual(4 * 3600_000);

    const dead = normalizeStreak({ days: 9, lastDay: '2026-09-10', lastAt: noon - 2 * 86_400_000 }, noon);
    expect(dead.days).toBe(0);
    expect(shareStreakLabel(dead)).toBe('Share today to start a streak');
    expect(formatDiesIn(90 * 60_000)).toBe('2h');
  });
});

describe('progress + race + hooks', () => {
  it('fills the ring toward #1 without inventing friends', () => {
    expect(progressPct(0, 0, 'entered')).toBe(0);
    expect(progressPct(1, 1, 'rising')).toBeGreaterThan(40);
    expect(progressPct(3, 3, 'banner')).toBe(100);
  });

  it('names the weekly clock and rank gap from real race rows', () => {
    expect(utcWeekEndMs(noon)).toBe(Date.parse('2026-09-14T00:00:00.000Z'));
    expect(weekClockLabel(noon)).toMatch(/left this week/);
    expect(
      raceGap({
        host: 'beta.test',
        race: [
          { host: 'alpha.test', weeklyCredits: 4, label: 'alpha.test' },
          { host: 'beta.test', weeklyCredits: 2, label: 'beta.test' },
        ],
      }),
    ).toBe('#2 · 2 behind alpha.test');
    expect(raceGap({ host: 'alpha.test', race: [{ host: 'alpha.test', weeklyCredits: 4, label: 'alpha.test' }] })).toBe(
      '#1 this week · hold it',
    );
  });

  it('writes Rising expiry copy only while the chip is live', () => {
    expect(risingHook(noon + 12 * 60_000, noon)).toBe('Your Rising expires in 12m — send one more');
    expect(risingHook(noon - 1000, noon)).toBeNull();
  });

  it('keeps ghost counts honest and rotates micro-goals', () => {
    expect(ghostCount(0, 0)).toBeNull();
    expect(ghostCount(2, 3)).toBe('2 live sites · 3 in the race');
    expect(microGoal({ credits: 0, weekly: 0, kitOpen: false, rung: 'entered', joined: false }, 0)).toContain(
      'Paste a site',
    );
    expect(microGoal({ credits: 0, weekly: 0, kitOpen: true, rung: 'entered', joined: true }, 0)).toContain(
      'Copy your link',
    );
  });
});
