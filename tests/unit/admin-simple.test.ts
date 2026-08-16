import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EXTRA_TABS,
  ADMIN_PRIMARY_TABS,
  initAdminDesk,
  initAdminSimple,
  isAdminExtraTab,
  isAdminMoreOpen,
  isAdminStatsMoreOpen,
  syncAdminTabCoach,
} from '../../src/lib/admin-simple';

describe('admin one-loop desk', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-desk');
    document.documentElement.removeAttribute('data-vr-admin-more');
    document.documentElement.removeAttribute('data-vr-admin-stats-more');
    document.body.innerHTML = `
      <button id="admin-more-tools-btn" type="button">More tools</button>
      <button id="admin-stats-more-btn" type="button">More numbers</button>
      <p id="admin-tab-coach"></p>
    `;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-admin-simple');
    document.documentElement.removeAttribute('data-vr-admin-desk');
  });

  it('keeps one primary desk and no extra tabs', () => {
    expect(ADMIN_PRIMARY_TABS).toEqual([0]);
    expect(ADMIN_EXTRA_TABS).toEqual([]);
    expect(isAdminExtraTab(1)).toBe(false);
    expect(isAdminExtraTab(0)).toBe(false);
  });

  it('turns on desk mode and hides extra nav', () => {
    initAdminDesk();
    expect(document.documentElement.getAttribute('data-vr-admin-desk')).toBe('1');
    expect(document.documentElement.getAttribute('data-vr-admin-simple')).toBe('1');
    expect(isAdminMoreOpen()).toBe(false);
    expect(isAdminStatsMoreOpen()).toBe(false);
    expect(document.getElementById('admin-more-tools-btn')?.hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('admin-stats-more-btn')?.hasAttribute('hidden')).toBe(true);
  });

  it('writes a loop coach line', () => {
    initAdminSimple();
    syncAdminTabCoach(3);
    expect(document.getElementById('admin-tab-coach')?.textContent).toMatch(/get-link/i);
  });
});
