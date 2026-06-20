import { describe, expect, it } from 'vitest';
import { computeVisitorFunnelStats } from '../../src/lib/visitor-tracking';

describe('visitor-tracking stats', () => {
  it('counts unique visitors per funnel step', () => {
    const events = [
      { event_name: 'SiteLanding', visitor_id: 'a', country_code: 'US' },
      { event_name: 'SiteLanding', visitor_id: 'a', country_code: 'US' },
      { event_name: 'SiteLanding', visitor_id: 'b', country_code: 'GB' },
      { event_name: 'GetReferralLink', visitor_id: 'a', country_code: 'US' },
      { event_name: 'GetReferralLink', visitor_id: 'c', country_code: 'DE' },
    ];
    const stats = computeVisitorFunnelStats(events);
    expect(stats.uniqueVisitorsLanding).toBe(2);
    expect(stats.funnel.find((r) => r.name === 'SiteLanding')).toMatchObject({ count: 3, unique: 2 });
    expect(stats.funnel.find((r) => r.name === 'GetReferralLink')).toMatchObject({ count: 2, unique: 2 });
  });

  it('groups country breakdown by landing unique visitors', () => {
    const events = [
      { event_name: 'SiteLanding', visitor_id: 'a', country_code: 'US' },
      { event_name: 'SiteLanding', visitor_id: 'a', country_code: 'US' },
      { event_name: 'SiteLanding', visitor_id: 'b', country_code: 'GB' },
    ];
    const stats = computeVisitorFunnelStats(events);
    expect(stats.byCountry).toEqual([
      { country: 'US', unique: 1, events: 2 },
      { country: 'GB', unique: 1, events: 1 },
    ]);
  });
});