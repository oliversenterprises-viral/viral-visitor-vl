import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EXTRA_TABS,
  ADMIN_PRIMARY_TABS,
  initAdminSimple,
  isAdminExtraTab,
  isAdminMoreOpen,
  setAdminMore,
  syncAdminTabCoach,
} from '../../src/lib/admin-simple';

describe('admin simple-first desk', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-more');
    sessionStorage.clear();
    document.body.innerHTML = `
      <button id="admin-more-tools-btn" type="button">More tools</button>
      <p id="admin-tab-coach"></p>
    `;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-more');
  });

  it('keeps three primary jobs and three extra tools', () => {
    expect(ADMIN_PRIMARY_TABS).toEqual([0, 2, 3]);
    expect(ADMIN_EXTRA_TABS).toEqual([1, 4, 5]);
    expect(isAdminExtraTab(1)).toBe(true);
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
});
