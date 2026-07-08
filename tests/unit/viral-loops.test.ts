import { describe, expect, it } from 'vitest';
import {
  appendChallengeParam,
  formatRivalDuelLine,
  formatChallengeSharePrefix,
  parseChallengeFromLocation,
} from '../../src/lib/challenge-mode';
import {
  referralsBehindLeader,
  formatAnxietyBarLine,
} from '../../src/lib/catch-up-anxiety';
import {
  communityUnlockLabel,
  communityUnlockPercent,
} from '../../src/lib/community-unlock';
import { buildWeeklySprintHtml } from '../../src/lib/weekly-sprint';
import {
  rankReceiptFilename,
  rankReceiptSignature,
} from '../../src/lib/rank-receipt-card';
import {
  DEFAULT_VIRAL_LOOPS_CONFIG,
  initViralLoopsConfigFromContent,
  getViralLoopsConfig,
} from '../../src/lib/viral-loops-config';
import { computeVisitorFunnelStats } from '../../src/lib/visitor-tracking';
import type { LeaderboardEntry } from '../../src/lib/types';

describe('challenge-mode', () => {
  it('detects ?challenge=1 in URL', () => {
    const loc = { search: '?challenge=1', pathname: '/r/VIRAL-ABC' } as Location;
    expect(parseChallengeFromLocation(loc)).toBe(true);
    expect(parseChallengeFromLocation({ search: '', pathname: '/' } as Location)).toBe(false);
  });

  it('appends challenge param to links', () => {
    expect(appendChallengeParam('https://www.viralrefer.app/r/VIRAL-ABC')).toContain('challenge=1');
  });

  it('formats rival duel line with rank', () => {
    const line = formatRivalDuelLine({
      referrer_code: 'VIRAL-RIVAL',
      referral_count: 5,
      rank: 3,
      on_board: true,
    });
    expect(line).toContain('VIRAL-RIVAL');
    expect(line).toContain('#3');
    expect(line).toContain('beat them');
  });

  it('formats challenge share prefix when enabled', () => {
    initViralLoopsConfigFromContent({ viral_loops_config: { challenge_enabled: true } });
    expect(formatChallengeSharePrefix('VIRAL-RIVAL')).toContain('beat VIRAL-RIVAL');
    initViralLoopsConfigFromContent({});
  });
});

describe('catch-up-anxiety', () => {
  const board: LeaderboardEntry[] = [
    { referrer_code: 'A', referral_count: 10, rank: 1 },
    { referrer_code: 'B', referral_count: 6, rank: 2 },
  ];

  it('computes gap behind #1', () => {
    expect(referralsBehindLeader(6, board)).toBe(4);
    expect(referralsBehindLeader(10, board)).toBeNull();
  });

  it('formats anxiety bar copy', () => {
    expect(formatAnxietyBarLine(3, 10)).toContain('3 referrals behind #1');
    expect(formatAnxietyBarLine(1, 10)).toContain('1 referral behind #1');
  });
});

describe('community-unlock', () => {
  it('computes percent toward goal', () => {
    expect(communityUnlockPercent(50, 100)).toBe(50);
    expect(communityUnlockPercent(150, 100)).toBe(100);
  });

  it('formats together label', () => {
    expect(communityUnlockLabel(42, 25)).toBe('Together: 42 / 25 referrals this week');
  });
});

describe('weekly-sprint', () => {
  it('formats sprint hero line', async () => {
    const { formatSprintHeroLine } = await import('../../src/lib/weekly-sprint');
    expect(formatSprintHeroLine([{ referrer_code: 'VIRAL-1', referral_count: 4, rank: 1 }])).toContain(
      'VIRAL-1',
    );
    expect(formatSprintHeroLine([])).toBe('');
  });

  it('renders sprint rows', () => {
    const html = buildWeeklySprintHtml([
      { referrer_code: 'VIRAL-1', referral_count: 4, rank: 1 },
    ]);
    expect(html).toContain('VIRAL-1');
    expect(html).toContain('weekly-sprint-row');
  });

  it('shows empty state', () => {
    expect(buildWeeklySprintHtml([])).toContain('first');
  });
});

describe('rank-receipt-card', () => {
  it('builds stable filename and signature', () => {
    expect(rankReceiptFilename('VIRAL-X')).toBe('viralrefer-receipt-VIRAL-X.png');
    expect(rankReceiptSignature({ code: 'VIRAL-X', link: 'https://x', rank: 2, referrals: 5 })).toBe(
      'VIRAL-X:5:2',
    );
  });
});

describe('viral-loops-config', () => {
  it('uses defaults when content missing', () => {
    initViralLoopsConfigFromContent({});
    expect(getViralLoopsConfig()).toEqual(DEFAULT_VIRAL_LOOPS_CONFIG);
  });

  it('parses overrides from site_content', () => {
    initViralLoopsConfigFromContent({
      viral_loops_config: {
        community_goal_weekly: 250,
        sprint_enabled: false,
      },
    });
    expect(getViralLoopsConfig().community_goal_weekly).toBe(250);
    expect(getViralLoopsConfig().sprint_enabled).toBe(false);
    initViralLoopsConfigFromContent({});
  });

  it('parses JSON string values from site_content', () => {
    initViralLoopsConfigFromContent({
      viral_loops_config: JSON.stringify({ community_goal_weekly: 75, challenge_enabled: false }),
    });
    expect(getViralLoopsConfig().community_goal_weekly).toBe(75);
    expect(getViralLoopsConfig().challenge_enabled).toBe(false);
    initViralLoopsConfigFromContent({});
  });
});

describe('visitor-tracking viral loops', () => {
  it('aggregates viral loop events in stats', () => {
    const stats = computeVisitorFunnelStats([
      { event_name: 'ChallengeLanding', visitor_id: 'a' },
      { event_name: 'ChallengeLanding', visitor_id: 'b' },
      { event_name: 'ReceiptGenerated', visitor_id: 'a' },
    ]);
    const challenge = stats.viralLoops.find((r) => r.name === 'ChallengeLanding');
    expect(challenge).toMatchObject({ count: 2, unique: 2 });
  });
});