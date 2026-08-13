import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EXTRA_TABS,
  ADMIN_PRIMARY_TABS,
  initAdminSimple,
  isAdminExtraTab,
  isAdminMoreOpen,
  isAdminStatsMoreOpen,
  setAdminMore,
  setAdminStatsMore,
  syncAdminTabCoach,
} from '../../src/lib/admin-simple';

describe('admin simple-first desk', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-more');
    document.documentElement.removeAttribute('data-vr-admin-stats-more');
    sessionStorage.clear();
    document.body.innerHTML = `
      <button id="admin-more-tools-btn" type="button">More tools</button>
      <button id="admin-stats-more-btn" type="button">More numbers</button>
      <p id="admin-tab-coach"></p>
    `;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-more');
    document.documentElement.removeAttribute('data-vr-admin-stats-more');
  });

  it('keeps three primary jobs and extra tools', () => {
    expect(ADMIN_PRIMARY_TABS).toEqual([0, 2, 3]);
    expect(ADMIN_EXTRA_TABS).toEqual([1, 4, 5, 6]);
    expect(isAdminExtraTab(1)).toBe(true);
    expect(isAdminExtraTab(6)).toBe(true);
    expect(isAdminExtraTab(0)).toBe(false);
  });

  it('turns on simple mode and toggles extras', () => {
    initAdminSimple();
    expect(document.documentElement.getAttribute('data-vr-admin-simple')).toBe('1');
    expect(isAdminMoreOpen()).toBe(false);
    setAdminMore(true);
    expect(isAdminMoreOpen()).toBe(true);
    expect(document.getElementById('admin-more-tools-btn')?.textContent).toBe('Hide extra tools');
  });

  it('writes a kid-simple coach line per tab', () => {
    initAdminSimple();
    syncAdminTabCoach(3);
    expect(document.getElementById('admin-tab-coach')?.textContent).toMatch(/homepage/i);
  });

  it('hides extra numbers until More numbers is pressed', () => {
    initAdminSimple();
    expect(isAdminStatsMoreOpen()).toBe(false);
    expect(document.getElementById('admin-stats-more-btn')?.textContent).toBe('More numbers');
    setAdminStatsMore(true);
    expect(isAdminStatsMoreOpen()).toBe(true);
    expect(document.documentElement.getAttribute('data-vr-admin-stats-more')).toBe('1');
    expect(document.getElementById('admin-stats-more-btn')?.textContent).toBe('Hide extra numbers');
  });
});
