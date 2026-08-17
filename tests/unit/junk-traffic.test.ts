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

  it('skips every SiteLanding write; conversion events still persist', () => {
    expect(shouldSkipServerLandingWrite('SiteLanding', 'rotate4all')).toBe(true);
    expect(shouldSkipServerLandingWrite('SiteLanding', 'reddit')).toBe(true);
    expect(shouldSkipServerLandingWrite('SiteLanding', null)).toBe(true);
    expect(shouldSkipServerLandingWrite('SiteLanding', '')).toBe(true);
    expect(shouldSkipServerLandingWrite('GetReferralLink', 'rotate4all')).toBe(false);
    expect(shouldSkipServerLandingWrite('GetReferralLink', 'reddit')).toBe(false);
    expect(shouldSkipServerLandingWrite('CopyReferralLink', null)).toBe(false);
    expect(shouldSkipServerLandingWrite('ShareReferral', null)).toBe(false);
    expect(shouldSkipServerLandingWrite('OpenPrizeClaim', null)).toBe(false);
    expect(shouldSkipServerLandingWrite('SubmitPrizeClaim', null)).toBe(false);
  });
});
