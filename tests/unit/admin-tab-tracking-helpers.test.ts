import { describe, it, expect } from 'vitest';
import {
  adminTabDaysLabel,
  computeReferralTrackingSummary,
  computeShareTrackingSummary,
  parseAdminTabDaysFilter,
} from '../../src/admin/admin-tab-tracking-helpers';
import { computeAnalyticsData } from '../../src/admin/share-analytics-helpers';
import { computeVariantConversion } from '../../src/lib/share-conversion';

describe('admin-tab-tracking-helpers', () => {
  it('parseAdminTabDaysFilter accepts known day windows', () => {
    expect(parseAdminTabDaysFilter('7')).toBe(7);
    expect(parseAdminTabDaysFilter('bad')).toBe(0);
  });

  it('adminTabDaysLabel maps filter values', () => {
    expect(adminTabDaysLabel(0)).toBe('All time');
    expect(adminTabDaysLabel(7)).toBe('7d');
  });

  it('computeReferralTrackingSummary aggregates filtered rows', () => {
    const now = new Date().toISOString();
    const summary = computeReferralTrackingSummary(10, 2, [
      { referrer_code: 'VIRAL-A', created_at: now },
      { referrer_code: 'VIRAL-A', created_at: now },
      { referrer_code: 'VIRAL-B', created_at: now },
    ], 7);
    expect(summary.inView).toBe(3);
    expect(summary.uniqueReferrers).toBe(2);
    expect(summary.topReferrer).toBe('VIRAL-A');
    expect(summary.topReferrerCount).toBe(2);
    expect(summary.highRiskIps).toBe(2);
    expect(summary.totalReal).toBe(10);
  });

  it('computeShareTrackingSummary uses analytics view data', () => {
    const shares = [
      { platform: 'twitter', referrer_code: 'VIRAL-1', created_at: new Date().toISOString() },
      { platform: 'twitter', referrer_code: 'VIRAL-2', created_at: new Date().toISOString() },
      { platform: 'reddit', referrer_code: 'VIRAL-1', created_at: new Date().toISOString() },
    ];
    const viewData = computeAnalyticsData(shares);
    const conversion = computeVariantConversion(shares, { 'VIRAL-1': 2 });
    const summary = computeShareTrackingSummary(shares, shares, viewData, conversion, 0, 30);
    expect(summary.inView).toBe(3);
    expect(summary.topPlatform).toBe('twitter');
    expect(summary.topPlatformCount).toBe(2);
    expect(summary.uniqueSharers).toBe(2);
  });
});