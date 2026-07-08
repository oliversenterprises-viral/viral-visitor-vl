import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildReferralsTrackingShellOpenHtml,
  reportReferralsTrackingSummary,
  wireReferralsTrackingHub,
} from '../../src/admin/referrals-tracking';

describe('referrals-tracking hub', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shell includes tracking hub markers', () => {
    const html = buildReferralsTrackingShellOpenHtml();
    expect(html).toContain('data-vr-referrals-tracking-hub');
    expect(html).toContain('referrals-tracking-header-slot');
    expect(html).toContain('data-referrals-tracking-collapse');
  });

  it('wireReferralsTrackingHub renders KPIs after summary report', () => {
    const hub = document.createElement('div');
    hub.innerHTML = buildReferralsTrackingShellOpenHtml() + '</div></div>';
    document.body.appendChild(hub);
    const root = hub.querySelector('[data-vr-referrals-tracking-hub]') as HTMLElement;

    wireReferralsTrackingHub(root, {
      onRefresh: () => {},
      onRangeChange: () => {},
      getCopyPayload: () => '{}',
    });

    reportReferralsTrackingSummary({
      totalReal: 5,
      inView: 3,
      uniqueReferrers: 2,
      today: 1,
      highRiskIps: 0,
      filterDays: 7,
      topReferrer: 'VIRAL-A',
      topReferrerCount: 2,
    });

    const header = root.querySelector('#referrals-tracking-header-slot');
    expect(header?.innerHTML).toContain('Referral Analytics');
    expect(header?.innerHTML).toContain('VIRAL-A');
    expect(header?.innerHTML).toContain('3');
  });
});