import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildShareTrackingShellOpenHtml,
  reportShareTrackingSummary,
  SHARE_TRACKING_SHELL_CLOSE,
  wireShareTrackingHub,
} from '../../src/admin/share-analytics-tracking';

describe('share-analytics-tracking hub', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shell wraps analytics content', () => {
    const html = buildShareTrackingShellOpenHtml() + '<div id="inner">x</div>' + SHARE_TRACKING_SHELL_CLOSE;
    expect(html).toContain('data-vr-share-tracking-hub');
    expect(html).toContain('share-tracking-header-slot');
    expect(html).toContain('data-share-tracking-collapse');
    expect(html).toContain('id="inner"');
  });

  it('wireShareTrackingHub renders KPIs after summary report', () => {
    const root = document.createElement('div');
    root.innerHTML = buildShareTrackingShellOpenHtml() + SHARE_TRACKING_SHELL_CLOSE;
    document.body.appendChild(root);
    const hub = root.querySelector('[data-vr-share-tracking-hub]') as HTMLElement;

    wireShareTrackingHub(hub, {
      onRefresh: () => {},
      onRangeChange: () => {},
      getCopyPayload: () => '{}',
    });

    reportShareTrackingSummary({
      totalAllTime: 20,
      inView: 12,
      uniqueSharers: 4,
      platforms: 3,
      topPlatform: 'twitter',
      topPlatformCount: 7,
      peakDay: 'Jul 3',
      peakDayCount: 5,
      conversionLeader: 'Variant A',
      filterDays: 0,
      testShareCount: 1,
    });

    const header = hub.querySelector('#share-tracking-header-slot');
    expect(header?.innerHTML).toContain('Share Analytics');
    expect(header?.innerHTML).toContain('twitter');
    expect(header?.innerHTML).toContain('Variant A');
  });
});