import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  funnelStepStates,
  isReferredLanding,
  resolveLandingReferrerCode,
} from '../../src/lib/funnel-conversion';

describe('funnel-conversion helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', { pathname: '/', search: '' });
  });

  it('isReferredLanding is true for /r/ path', () => {
    vi.stubGlobal('location', { pathname: '/r/VIRAL-TEST01', search: '' });
    expect(isReferredLanding()).toBe(true);
    expect(resolveLandingReferrerCode()).toBe('VIRAL-TEST01');
  });

  it('isReferredLanding is true for ?ref= query', () => {
    vi.stubGlobal('location', { pathname: '/', search: '?ref=VIRAL-QUERY' });
    expect(isReferredLanding()).toBe(true);
  });

  it('isReferredLanding is false on plain homepage', () => {
    expect(isReferredLanding()).toBe(false);
  });

  it('funnelStepStates marks step 2 active after link ready', () => {
    const states = funnelStepStates(2);
    expect(states[0]).toMatchObject({ step: 1, done: true, active: false });
    expect(states[1]).toMatchObject({ step: 2, done: false, active: true });
    expect(states[2]).toMatchObject({ step: 3, pending: true });
  });
});