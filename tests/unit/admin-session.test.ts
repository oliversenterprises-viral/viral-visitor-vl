import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAdminSessionToken,
  getAdminSessionToken,
  hasAdminSession,
  isOwnerHqContext,
  isOwnerParam,
  markOwnerHqSurface,
  setAdminSessionToken,
} from '../../src/lib/admin-session';

describe('admin-session', () => {
  beforeEach(() => {
    clearAdminSessionToken();
  });

  afterEach(() => {
    clearAdminSessionToken();
  });

  it('stores and clears session token in sessionStorage', () => {
    expect(hasAdminSession()).toBe(false);
    setAdminSessionToken('test-token');
    expect(getAdminSessionToken()).toBe('test-token');
    expect(hasAdminSession()).toBe(true);
    clearAdminSessionToken();
    expect(getAdminSessionToken()).toBe('');
  });

  it('treats ?owner=1 and an owner session as HQ context', () => {
    expect(isOwnerParam({ search: '?owner=1', hash: '' } as Location)).toBe(true);
    expect(isOwnerParam({ search: '', hash: '#owner' } as Location)).toBe(true);
    expect(isOwnerParam({ search: '', hash: '' } as Location)).toBe(false);
    expect(isOwnerHqContext({ search: '?owner=1', hash: '' } as Location)).toBe(true);
    setAdminSessionToken('desk-token');
    expect(isOwnerHqContext({ search: '', hash: '' } as Location)).toBe(true);
    markOwnerHqSurface();
    expect(document.documentElement.getAttribute('data-vr-owner-hq')).toBe('1');
    document.documentElement.removeAttribute('data-vr-owner-hq');
  });
});