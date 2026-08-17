import { describe, expect, it } from 'vitest';
import { isJunkTrafficSource, shouldSkipServerLandingWrite } from '../../src/lib/junk-traffic';

describe('junk-traffic (Disk IO guard)', () => {
  it('flags rotator / exchange sources', () => {
    expect(isJunkTrafficSource('rotate4all')).toBe(true);
    expect(isJunkTrafficSource('Rotate4All')).toBe(true);
    expect(isJunkTrafficSource('hitleap')).toBe(true);
    expect(isJunkTrafficSource('trafficexchange')).toBe(true);
    expect(isJunkTrafficSource('traffup')).toBe(true);
    expect(isJunkTrafficSource('https://traffup.net')).toBe(true);
    expect(isJunkTrafficSource('herculist')).toBe(true);
    expect(isJunkTrafficSource('pagerankcafe')).toBe(true);
    expect(isJunkTrafficSource('leadsleap')).toBe(true);
  });

  it('allows real sources', () => {
    expect(isJunkTrafficSource(null)).toBe(false);
    expect(isJunkTrafficSource('')).toBe(false);
    expect(isJunkTrafficSource('twitter')).toBe(false);
    expect(isJunkTrafficSource('reddit')).toBe(false);
    expect(isJunkTrafficSource('leadmagnet')).toBe(false);
  });

  it('skips only SiteLanding writes for junk sources', () => {
    expect(shouldSkipServerLandingWrite('SiteLanding', 'rotate4all')).toBe(true);
    expect(shouldSkipServerLandingWrite('GetReferralLink', 'rotate4all')).toBe(false);
    expect(shouldSkipServerLandingWrite('SiteLanding', 'reddit')).toBe(false);
  });
});
