import { describe, it, expect } from 'vitest';
import { buildLeaderboardHtml, buildRankGapSummary } from '../../src/lib/leaderboard-ui';

const entries = [
  { referrer_code: 'VIRAL-LEAD', referral_count: 5, rank: 1 },
  { referrer_code: 'VIRAL-CHASE', referral_count: 2, rank: 2 },
];

describe('leaderboard-ui', () => {
  it('buildLeaderboardHtml highlights #1 with gold class', () => {
    const html = buildLeaderboardHtml(entries);
    expect(html).toContain('leaderboard-row--gold');
    expect(html).toContain('👑');
  });

  it('buildRankGapSummary for chaser', () => {
    const html = buildRankGapSummary('VIRAL-CHASE', 2, 2, entries);
    expect(html).toContain('reach #1');
  });
});