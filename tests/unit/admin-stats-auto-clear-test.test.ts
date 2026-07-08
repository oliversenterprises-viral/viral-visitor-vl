import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_STATS_AUTO_CLEAR_TEST_KEY,
  buildAutoClearTestSelectHtml,
  clearAdminStatsAutoClearTestTimer,
  getStoredAutoClearTestMs,
  resetAdminStatsAutoClearTestForTests,
  scheduleAdminStatsAutoClearTest,
  storeAutoClearTestMs,
  syncAutoClearTestSelects,
  wireEditContentAutoClearTest,
} from '../../src/lib/admin-stats-auto-clear-test';

describe('admin stats auto-clear test', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    resetAdminStatsAutoClearTestForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAdminStatsAutoClearTestForTests();
    localStorage.clear();
  });

  it('buildAutoClearTestSelectHtml reflects stored interval', () => {
    storeAutoClearTestMs(300_000);
    const html = buildAutoClearTestSelectHtml();
    expect(html).toContain('value="300000" selected');
    expect(html).toContain('5m');
    expect(html).toContain('data-admin-autoclear-test');
  });

  it('scheduleAdminStatsAutoClearTest ticks on interval until root removed', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const tick = vi.fn();
    storeAutoClearTestMs(60_000);

    wireEditContentAutoClearTest(root, tick);
    expect(tick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(1);

    root.remove();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(tick).toHaveBeenCalledTimes(1);
    clearAdminStatsAutoClearTestTimer();
  });

  it('wireEditContentAutoClearTest persists selection and requires confirm when enabling', async () => {
    const root = document.createElement('div');
    root.innerHTML = `${buildAutoClearTestSelectHtml()}${buildAutoClearTestSelectHtml()}`;
    document.body.appendChild(root);
    const tick = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    wireEditContentAutoClearTest(root, tick);
    const selects = root.querySelectorAll('select[data-admin-autoclear-test]');
    expect(selects.length).toBe(2);

    (selects[0] as HTMLSelectElement).value = '120000';
    selects[0].dispatchEvent(new Event('change', { bubbles: true }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(getStoredAutoClearTestMs()).toBe(120_000);
    expect((selects[1] as HTMLSelectElement).value).toBe('120000');

    await vi.advanceTimersByTimeAsync(120_000);
    expect(tick).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
    clearAdminStatsAutoClearTestTimer();
  });

  it('canceling confirm keeps auto-clear off', () => {
    const root = document.createElement('div');
    root.innerHTML = buildAutoClearTestSelectHtml();
    document.body.appendChild(root);
    const tick = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    wireEditContentAutoClearTest(root, tick);
    const select = root.querySelector('select[data-admin-autoclear-test]') as HTMLSelectElement;
    select.value = '60000';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(getStoredAutoClearTestMs()).toBe(0);
    expect(select.value).toBe('0');
    expect(localStorage.getItem(ADMIN_STATS_AUTO_CLEAR_TEST_KEY)).toBeNull();

    confirmSpy.mockRestore();
  });

  it('syncAutoClearTestSelects aligns all dropdowns', () => {
    storeAutoClearTestMs(900_000);
    const root = document.createElement('div');
    root.innerHTML = buildAutoClearTestSelectHtml() + buildAutoClearTestSelectHtml();
    syncAutoClearTestSelects(root);
    root.querySelectorAll<HTMLSelectElement>('select[data-admin-autoclear-test]').forEach((select) => {
      expect(select.value).toBe('900000');
    });
  });
});