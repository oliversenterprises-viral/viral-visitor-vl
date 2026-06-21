import { describe, expect, it } from 'vitest';
import { computeRedditFunnelStats } from '../../src/lib/reddit-tracking';
import { latestEvents } from '../../src/lib/stats-helpers';

describe('stats-helpers', () => {
  it('latestEvents returns newest first', () => {
    const rows = [
      { created_at: '2026-06-20T10:00:00Z' },
      { created_at: '2026-06-20T22:00:00Z' },
      { created_at: '2026-06-20T15:00:00Z' },
    ];
    expect(latestEvents(rows, 2).map((r) => r.created_at)).toEqual([
      '2026-06-20T22:00:00Z',
      '2026-06-20T15:00:00Z',
    ]);
  });

  it('reddit byCampaign counts RedditLanding only', () => {
    const events = [
      { event_name: 'RedditLanding', utm_campaign: 'launch' },
      { event_name: 'RedditLanding', utm_campaign: 'launch' },
      { event_name: 'GetReferralLink', utm_campaign: 'launch' },
    ];
    const stats = computeRedditFunnelStats(events);
    expect(stats.byCampaign).toEqual({ launch: 2 });
  });
});