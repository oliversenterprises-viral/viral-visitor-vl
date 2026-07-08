import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTrackingHubShellHtml, wireEditContentTrackingHub } from '../../src/admin/edit-content-tracking';
import {
  loadTrackingTimeRange,
  reportTrackingHubSummary,
} from '../../src/admin/edit-content-tracking-helpers';

describe('edit-content-tracking hub', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('buildTrackingHubShellHtml includes visitor and banner quick panels', () => {
    const html = buildTrackingHubShellHtml();
    expect(html).toContain('data-vr-tracking-hub');
    expect(html).toContain('id="visitor-stats-quick"');
    expect(html).toContain('id="banner-stats-quick"');
    expect(html).toContain('tracking-hub-header-slot');
  });

  it('wireEditContentTrackingHub renders summary after partial report', () => {
    const root = document.createElement('div');
    root.dataset.vrEditContentRoot = '1';
    root.innerHTML = buildTrackingHubShellHtml();
    document.body.appendChild(root);

    wireEditContentTrackingHub(root);

    expect(root.querySelector('[data-tracking-refresh-all]')).toBeTruthy();

    reportTrackingHubSummary({
      landings: 12,
      engaged: 8,
      sessions: 6,
      claimConversion: '8.3%',
      bannerImpressions: 40,
      bannerClicks: 5,
      bannerCtr: '12.5%',
      visitorSource: 'server',
      bannerSource: 'local',
      visitorEvents: 30,
      bannerEvents: 40,
    });

    const header = root.querySelector('#tracking-hub-header-slot');
    expect(header?.innerHTML).toContain('Landings');
    expect(header?.innerHTML).toContain('12');
    expect(header?.innerHTML).toContain('Banner CTR');
    expect(header?.innerHTML).toContain('12.5%');
  });

  it('refresh all triggers both panel renders', async () => {
    const { clearAdminSessionToken } = await import('../../src/lib/admin-session');
    clearAdminSessionToken();
    const root = document.createElement('div');
    root.dataset.vrEditContentRoot = '1';
    root.innerHTML = buildTrackingHubShellHtml();
    document.body.appendChild(root);
    wireEditContentTrackingHub(root);

    const visitor = root.querySelector('#visitor-stats-quick') as HTMLElement;
    const banner = root.querySelector('#banner-stats-quick') as HTMLElement;
    visitor.innerHTML = '<span data-visitor-stats-refresh></span>';
    banner.innerHTML = '<span data-banner-stats-refresh></span>';

    const btn = root.querySelector('[data-tracking-refresh-all]') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(btn.disabled).toBe(false);
  });

  it('loadTrackingTimeRange reads persisted value', () => {
    localStorage.setItem('vr_admin_tracking_time_range', '7d');
    expect(loadTrackingTimeRange()).toBe('7d');
  });
});