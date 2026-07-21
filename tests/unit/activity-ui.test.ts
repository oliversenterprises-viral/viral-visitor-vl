import { describe, it, expect } from 'vitest';
import { formatRelativeTime, buildRecentActivityHtml } from '../../src/lib/activity-ui';

describe('activity-ui', () => {
  it('formatRelativeTime shows just now for recent', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 5000).toISOString(), now)).toBe('just now');
  });

  it('buildRecentActivityHtml marks first row fresh and shows who got credit', () => {
    const html = buildRecentActivityHtml([
      { kind: 'referral', referrer_code: 'VIRAL-X', created_at: new Date().toISOString() },
    ]);
    expect(html).toContain('activity-row--fresh');
    expect(html).toContain('VIRAL-X');
    expect(html).toContain('got credit');
    expect(html).toMatch(/Referrer/i);
  });

  it('buildRecentActivityHtml renders share rows with referrer label', () => {
    const html = buildRecentActivityHtml([
      { kind: 'share', referrer_code: 'VIRAL-Z', created_at: new Date().toISOString(), platform: 'reddit' },
    ]);
    expect(html).toContain('shared on Reddit');
    expect(html).toContain('activity-row--share');
    expect(html).toContain('VIRAL-Z');
    expect(html).toMatch(/Referrer/i);
  });

  it('buildRecentActivityHtml renders rank move rows', () => {
    const html = buildRecentActivityHtml([
      {
        kind: 'rank_move',
        referrer_code: 'VIRAL-Q',
        created_at: new Date().toISOString(),
        previous_rank: 2,
        new_rank: 1,
      },
    ]);
    expect(html).toContain('claimed #1');
    expect(html).toContain('activity-row--rank');
  });
});