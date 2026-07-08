import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAdminSessionToken,
  getAdminSessionToken,
  hasAdminSession,
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
});