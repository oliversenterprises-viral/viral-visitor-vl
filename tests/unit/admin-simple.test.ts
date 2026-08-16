import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EXTRA_TABS,
  ADMIN_PRIMARY_TABS,
  initAdminDesk,
  initAdminSimple,
  isAdminExtraTab,
  isAdminMoreOpen,
  isAdminStatsMoreOpen,
  setAdminMore,
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
    document.documentElement.removeAttribute('data-vr-admin-more');
  });

  it('keeps Friends / Prize / Website words on the strip and extras behind More', () => {
    expect(ADMIN_PRIMARY_TABS).toEqual([0, 2, 3]);
    expect(ADMIN_EXTRA_TABS).toEqual([1, 4, 5, 6]);
    expect(isAdminExtraTab(0)).toBe(false);
    expect(isAdminExtraTab(3)).toBe(false);
    expect(isAdminExtraTab(1)).toBe(true);
  });

  it('turns on simple mode without CSS-hiding the old tab pile', () => {
    initAdminDesk();
    expect(document.documentElement.getAttribute('data-vr-admin-simple')).toBe('1');
    expect(document.documentElement.hasAttribute('data-vr-admin-desk')).toBe(false);
    expect(isAdminMoreOpen()).toBe(false);
    expect(isAdminStatsMoreOpen()).toBe(false);
    const more = document.getElementById('admin-more-tools-btn');
    expect(more).not.toBeNull();
    expect(more?.hasAttribute('hidden')).toBe(false);
    expect(more?.textContent).toMatch(/More tools/i);
  });

  it('can mark extra tools open without making them the first screen', () => {
    initAdminSimple();
    setAdminMore(true);
    expect(isAdminMoreOpen()).toBe(true);
    expect(document.getElementById('admin-more-tools-btn')?.hasAttribute('hidden')).toBe(false);
    setAdminMore(false);
    expect(isAdminMoreOpen()).toBe(false);
    expect(document.getElementById('admin-more-tools-btn')?.hasAttribute('hidden')).toBe(false);
  });

  it('writes a loop coach line on the desk', () => {
    initAdminSimple();
    syncAdminTabCoach(0);
    expect(document.getElementById('admin-tab-coach')?.textContent).toMatch(/get a link/i);
  });
});
