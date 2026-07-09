import { describe, it, expect } from 'vitest';
import { shouldShowExitRescue, buildExitRescueMessage } from '../../src/lib/exit-intent-rescue';

describe('exit-intent-rescue', () => {
  it('buildExitRescueMessage is concise and action-oriented', () => {
    const msg = buildExitRescueMessage();
    expect(msg.title).toMatch(/free|leaderboard/i);
    expect(msg.cta.toLowerCase()).toContain('link');
  });

  it('shouldShowExitRescue blocks referred, linked, or already shown', () => {
    const base = {
      isReferred: false,
      hasLink: false,
      alreadyShown: false,
      dwellMs: 8000,
      isCoarsePointer: false,
    };
    expect(shouldShowExitRescue(base)).toBe(true);
    expect(shouldShowExitRescue({ ...base, isReferred: true })).toBe(false);
    expect(shouldShowExitRescue({ ...base, hasLink: true })).toBe(false);
    expect(shouldShowExitRescue({ ...base, alreadyShown: true })).toBe(false);
    expect(shouldShowExitRescue({ ...base, dwellMs: 2000 })).toBe(false);
  });

  it('shouldShowExitRescue requires longer dwell on mobile', () => {
    expect(
      shouldShowExitRescue({
        isReferred: false,
        hasLink: false,
        alreadyShown: false,
        dwellMs: 10000,
        isCoarsePointer: true,
      }),
    ).toBe(false);
    expect(
      shouldShowExitRescue({
        isReferred: false,
        hasLink: false,
        alreadyShown: false,
        dwellMs: 25000,
        isCoarsePointer: true,
      }),
    ).toBe(true);
  });
});