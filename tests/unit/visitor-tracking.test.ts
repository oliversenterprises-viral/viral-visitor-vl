import { describe, expect, it } from 'vitest';
import {
  computeVisitorFunnelStats,
  formatVisitorEventDisplayName,
  parseVisitorEventMetadata,
} from '../../src/lib/visitor-tracking';

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

  it('shows newest events first regardless of array order', () => {
    const events = [
      { event_name: 'SiteLanding', created_at: '2026-06-20T16:00:00.000Z' },
      { event_name: 'SiteLanding', created_at: '2026-06-20T22:00:00.000Z' },
      { event_name: 'GetReferralLink', created_at: '2026-06-20T21:00:00.000Z' },
    ];
    const stats = computeVisitorFunnelStats(events);
    expect(stats.lastEvents[0].created_at).toBe('2026-06-20T22:00:00.000Z');
  });

  it('UTM source breakdown counts landings only', () => {
    const events = [
      { event_name: 'SiteLanding', utm_source: 'reddit' },
      { event_name: 'SiteLanding', utm_source: 'reddit' },
      { event_name: 'GetReferralLink', utm_source: 'reddit' },
      { event_name: 'SiteLanding', utm_source: null },
    ];
    const stats = computeVisitorFunnelStats(events);
    expect(stats.bySource).toEqual({ reddit: 2, '(direct)': 1 });
  });

  it('excludes passive viral impressions from engaged + recent events', () => {
    const events = [
      { event_name: 'SiteLanding', visitor_id: 'a', created_at: '2026-07-01T12:00:00Z' },
      { event_name: 'SprintBoardView', visitor_id: 'a', created_at: '2026-07-01T12:00:01Z' },
      { event_name: 'CommunityUnlockView', visitor_id: 'a', created_at: '2026-07-01T12:00:02Z' },
      { event_name: 'GetReferralLink', visitor_id: 'b', created_at: '2026-07-01T12:00:03Z' },
      { event_name: 'ChallengeDuelShared', visitor_id: 'c', created_at: '2026-07-01T12:00:04Z' },
    ];
    const stats = computeVisitorFunnelStats(events);
    expect(stats.uniqueVisitorsLanding).toBe(1);
    expect(stats.uniqueVisitorsAny).toBe(2);
    expect(stats.funnelEventCount).toBe(2);
    expect(stats.viralLoopEventCount).toBe(3);
    expect(stats.lastEvents.map((e) => e.event_name)).toEqual([
      'ChallengeDuelShared',
      'GetReferralLink',
      'SiteLanding',
    ]);
  });

  it('formatVisitorEventDisplayName humanizes funnel and loop steps', () => {
    expect(formatVisitorEventDisplayName('GetReferralLink')).toBe('Get link');
    expect(formatVisitorEventDisplayName('ChallengeDuelShared')).toContain('Loop:');
  });

  it('parseVisitorEventMetadata reads JSON string metadata', () => {
    const meta = parseVisitorEventMetadata({
      metadata: '{"client_ip":"203.0.113.1","platform":"x"}',
    });
    expect(meta.client_ip).toBe('203.0.113.1');
    expect(meta.platform).toBe('x');
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