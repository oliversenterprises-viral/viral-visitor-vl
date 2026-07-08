import { describe, it, expect } from 'vitest';
import {
  buildTrackingHubSummary,
  computeFunnelStepConversions,
  countUniqueSessions,
  filterEventsByTrackingRange,
  parseTrackingTimeRange,
} from '../../src/admin/edit-content-tracking-helpers';

describe('edit-content-tracking-helpers', () => {
  const now = new Date('2026-07-03T12:00:00Z').getTime();

  it('parseTrackingTimeRange accepts known values', () => {
    expect(parseTrackingTimeRange('24h')).toBe('24h');
    expect(parseTrackingTimeRange('bad')).toBe('all');
  });

  it('filterEventsByTrackingRange keeps events inside window', () => {
    const events = [
      { created_at: '2026-07-02T12:00:00Z' },
      { created_at: '2026-06-01T12:00:00Z' },
      { timestamp: '2026-07-03T11:00:00Z' },
    ];
    const filtered = filterEventsByTrackingRange(events, '24h', now);
    expect(filtered).toHaveLength(2);
  });

  it('computeFunnelStepConversions derives step and landing rates', () => {
    const funnel = [
      { name: 'SiteLanding', count: 10, unique: 10 },
      { name: 'GetReferralLink', count: 6, unique: 5 },
      { name: 'SubmitPrizeClaim', count: 2, unique: 2 },
    ];
    const conv = computeFunnelStepConversions(funnel);
    expect(conv[0].stepRate).toBe('100%');
    expect(conv[1].stepRate).toBe('50.0%');
    expect(conv[2].overallRate).toBe('20.0%');
  });

  it('countUniqueSessions counts distinct session ids', () => {
    const events = [
      { session_id: 'a' },
      { session_id: 'b' },
      { session_id: 'a' },
      { sessionId: 'c' },
    ];
    expect(countUniqueSessions(events)).toBe(3);
  });

  it('buildTrackingHubSummary aggregates banner totals', () => {
    const summary = buildTrackingHubSummary({
      range: '7d',
      funnel: [],
      claimConversion: '12.5%',
      sessions: 4,
      engaged: 8,
      landings: 10,
      visitorSource: 'server',
      bannerSource: 'server',
      visitorEvents: 20,
      bannerEvents: 15,
      bannerRows: [
        { key: 'a', label: 'A', redirectUrl: 'https://a', impressions: 10, clicks: 2 },
        { key: 'b', label: 'B', redirectUrl: 'https://b', impressions: 5, clicks: 1 },
      ],
    });
    expect(summary.bannerImpressions).toBe(15);
    expect(summary.bannerClicks).toBe(3);
    expect(summary.bannerCtr).toBe('20.0%');
    expect(summary.range).toBe('7d');
  });
});