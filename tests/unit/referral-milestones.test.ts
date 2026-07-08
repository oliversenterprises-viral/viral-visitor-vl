import { describe, it, expect } from 'vitest';
import { detectMilestones } from '../../src/lib/referral-milestones';

describe('referral-milestones', () => {
  it('detects first referral milestone', () => {
    const events = detectMilestones(0, 1, null, 3);
    expect(events.some((e) => e.kind === 'first_referral')).toBe(true);
  });

  it('detects prize threshold at 10', () => {
    const events = detectMilestones(9, 10, 2, 1);
    expect(events.some((e) => e.kind === 'prize_threshold')).toBe(true);
    expect(events.some((e) => e.kind === 'rank_one')).toBe(true);
  });

  it('detects top 3 entry', () => {
    const events = detectMilestones(2, 3, 5, 3);
    expect(events.some((e) => e.kind === 'rank_top3')).toBe(true);
  });

  it('no events when unchanged', () => {
    expect(detectMilestones(5, 5, 2, 2)).toEqual([]);
  });
});