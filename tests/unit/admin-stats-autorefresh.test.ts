import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAutorefreshSelectHtml,
  clearAdminStatsAutorefresh,
  getStoredAutorefreshMs,
  scheduleAdminStatsAutorefresh,
  storeAutorefreshMs,
  wireAdminStatsAutorefresh,
} from '../../src/lib/admin-stats-autorefresh';
import {
  isAdminStatsReadOnlyRefresh,
  resetAdminStatsRefreshGuardForTests,
  withAdminStatsReadOnlyRefresh,
} from '../../src/lib/admin-stats-refresh-guard';
import { trackVisitorFunnel } from '../../src/lib/visitor-tracking';

describe('admin stats autorefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAdminStatsRefreshGuardForTests();
    localStorage.clear();
  });

  it('buildAutorefreshSelectHtml reflects stored interval', () => {
    storeAutorefreshMs('vr_test_autorefresh', 60_000);
    const html = buildAutorefreshSelectHtml('data-test-autorefresh', 'vr_test_autorefresh');
    expect(html).toContain('value="60000" selected');
    expect(html).toContain('1m');
  });

  it('scheduleAdminStatsAutorefresh ticks on interval until container removed', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tick = vi.fn();
    storeAutorefreshMs('vr_test_autorefresh', 15_000);

    scheduleAdminStatsAutorefresh(container, 'vr_test_autorefresh', tick);
    expect(tick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(15_000);
    expect(tick).toHaveBeenCalledTimes(1);

    container.remove();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('wireAdminStatsAutorefresh persists selection and restarts timer', async () => {
    const container = document.createElement('div');
    container.innerHTML = buildAutorefreshSelectHtml('data-test-autorefresh', 'vr_test_autorefresh');
    document.body.appendChild(container);
    const tick = vi.fn();

    wireAdminStatsAutorefresh(container, 'vr_test_autorefresh', 'data-test-autorefresh', tick);
    const select = container.querySelector('select') as HTMLSelectElement;
    select.value = '30000';
    select.dispatchEvent(new Event('change'));

    expect(getStoredAutorefreshMs('vr_test_autorefresh')).toBe(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tick).toHaveBeenCalledTimes(1);

    clearAdminStatsAutorefresh(container);
  });
});

describe('admin stats refresh guard', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAdminStatsRefreshGuardForTests();
  });

  afterEach(() => {
    resetAdminStatsRefreshGuardForTests();
    localStorage.clear();
  });

  it('withAdminStatsReadOnlyRefresh blocks trackVisitorFunnel writes', async () => {
    expect(isAdminStatsReadOnlyRefresh()).toBe(false);

    await withAdminStatsReadOnlyRefresh(async () => {
      expect(isAdminStatsReadOnlyRefresh()).toBe(true);
      trackVisitorFunnel('SiteLanding', { path: '/admin' });
    });

    expect(isAdminStatsReadOnlyRefresh()).toBe(false);
    expect(JSON.parse(localStorage.getItem('viralrefer_visitor_events') || '[]')).toEqual([]);
  });
});