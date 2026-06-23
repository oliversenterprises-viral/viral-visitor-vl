import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeRedditFunnelStats } from '../../src/lib/reddit-tracking';
import {
  formatEventTimestampLabel,
  formatRelativeTime,
  latestEventTimestamp,
  latestEvents,
} from '../../src/lib/stats-helpers';

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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formatRelativeTime returns human-readable deltas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T14:00:00Z'));
    expect(formatRelativeTime('2026-06-22T13:00:00Z')).toBe('1h ago');
    expect(formatRelativeTime('2026-06-22T13:59:00Z')).toBe('1m ago');
  });

  it('formatEventTimestampLabel combines clock and relative time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T14:00:00Z'));
    const label = formatEventTimestampLabel('2026-06-22T12:00:00Z');
    expect(label).toContain('Jun');
    expect(label).toContain('2h ago');
  });

  it('latestEventTimestamp reads newest event', () => {
    expect(
      latestEventTimestamp([
        { created_at: '2026-06-20T10:00:00Z' },
        { timestamp: '2026-06-20T22:00:00Z' },
      ]),
    ).toBe('2026-06-20T22:00:00Z');
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