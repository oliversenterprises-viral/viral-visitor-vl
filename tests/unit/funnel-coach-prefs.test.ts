import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FUNNEL_COACH_VISITOR_PREFS_KEY,
  isFunnelCoachActive,
  isFunnelCoachSiteEnabled,
  isFunnelCoachVisitorEnabled,
  setFunnelCoachVisitorEnabled,
} from '../../src/lib/funnel-coach-prefs';

describe('funnel-coach-prefs', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-vr-funnel-coach-site');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-funnel-coach-site');
  });

  it('visitor preference defaults to enabled', () => {
    expect(isFunnelCoachVisitorEnabled()).toBe(true);
    expect(localStorage.getItem(FUNNEL_COACH_VISITOR_PREFS_KEY)).toBeNull();
  });

  it('setFunnelCoachVisitorEnabled persists off state', () => {
    setFunnelCoachVisitorEnabled(false);
    expect(isFunnelCoachVisitorEnabled()).toBe(false);
    expect(localStorage.getItem(FUNNEL_COACH_VISITOR_PREFS_KEY)).toBe('0');
    setFunnelCoachVisitorEnabled(true);
    expect(isFunnelCoachVisitorEnabled()).toBe(true);
  });

  it('isFunnelCoachSiteEnabled reads optimizer DOM attr', () => {
    expect(isFunnelCoachSiteEnabled()).toBe(true);
    document.documentElement.setAttribute('data-vr-funnel-coach-site', 'off');
    expect(isFunnelCoachSiteEnabled()).toBe(false);
  });

  it('isFunnelCoachActive requires site and visitor prefs', () => {
    expect(isFunnelCoachActive()).toBe(true);
    setFunnelCoachVisitorEnabled(false);
    expect(isFunnelCoachActive()).toBe(false);
    setFunnelCoachVisitorEnabled(true);
    document.documentElement.setAttribute('data-vr-funnel-coach-site', 'off');
    expect(isFunnelCoachActive()).toBe(false);
  });
});