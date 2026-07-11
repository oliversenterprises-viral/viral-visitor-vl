import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFunnelNudgeSoundEnabled,
  setFunnelNudgeSoundEnabled,
  tonesForNudge,
  resetFunnelNudgeSoundForTests,
} from '../../src/lib/funnel-nudge-sound';

describe('funnel-nudge-sound', () => {
  beforeEach(() => {
    localStorage.clear();
    resetFunnelNudgeSoundForTests();
  });

  it('defaults to enabled', () => {
    expect(isFunnelNudgeSoundEnabled()).toBe(true);
  });

  it('can be disabled via storage', () => {
    setFunnelNudgeSoundEnabled(false);
    expect(isFunnelNudgeSoundEnabled()).toBe(false);
    setFunnelNudgeSoundEnabled(true);
    expect(isFunnelNudgeSoundEnabled()).toBe(true);
  });

  it('defines distinct soft tone sequences per kind', () => {
    const link = tonesForNudge('link-ready');
    const copy = tonesForNudge('copy-nudge');
    const share = tonesForNudge('share-nudge');
    const banner = tonesForNudge('banner');
    expect(link.length).toBeGreaterThanOrEqual(2);
    expect(copy.length).toBeGreaterThanOrEqual(2);
    expect(share.length).toBeGreaterThanOrEqual(2);
    expect(banner.length).toBeGreaterThanOrEqual(2);
    // Keep volumes soft (non-startling)
    for (const tone of [...link, ...copy, ...share, ...banner]) {
      expect(tone.v ?? 0.09).toBeLessThanOrEqual(0.12);
      expect(tone.d).toBeLessThanOrEqual(200);
    }
  });
});
