import { describe, it, expect } from 'vitest';
import {
  dailyCrownFlairCodes,
  formatCountdown,
  formatCrownDay,
  formatDailyCrownRaceLine,
  parseDailyCrownStatus,
  type DailyCrownStatus,
} from '../../src/lib/daily-crown';
import {
  buildDailyCrownShareCardHtml,
  dailyCrownFilename,
} from '../../src/lib/daily-crown-card';

describe('daily-crown pure helpers', () => {
  it('formatCountdown handles hours and minutes', () => {
    expect(formatCountdown(3661)).toBe('1h 1m');
    expect(formatCountdown(125)).toBe('2m 5s');
    expect(formatCountdown(9)).toBe('9s');
    expect(formatCountdown(-5)).toBe('0s');
  });

  it('formatCrownDay formats YYYY-MM-DD', () => {
    expect(formatCrownDay('2026-08-02')).toBe('Aug 2, 2026');
    expect(formatCrownDay('2026-08-02T00:00:00Z')).toBe('Aug 2, 2026');
    expect(formatCrownDay(undefined)).toBe('');
  });

  it('parseDailyCrownStatus maps RPC JSON safely', () => {
    const status = parseDailyCrownStatus({
      timezone: 'UTC',
      today_utc: '2026-08-03',
      window_start: '2026-08-03T00:00:00Z',
      window_end: '2026-08-04T00:00:00Z',
      seconds_remaining: 3600,
      current_leader: { referrer_code: 'VIRAL-LEAD1', referral_count: 4, rank: 1 },
      today_board: [
        { referrer_code: 'VIRAL-LEAD1', referral_count: 4, rank: 1 },
        { referrer_code: 'VIRAL-SEC02', referral_count: 2, rank: 2 },
      ],
      yesterday_champion: {
        day_utc: '2026-08-02',
        referrer_code: 'VIRAL-YEST1',
        referral_count: 9,
      },
      hall: [
        { day_utc: '2026-08-02', referrer_code: 'VIRAL-YEST1', referral_count: 9 },
        { day_utc: '2026-08-01', referrer_code: 'VIRAL-OLD01', referral_count: 3 },
      ],
    });

    expect(status).not.toBeNull();
    expect(status!.current_leader?.referrer_code).toBe('VIRAL-LEAD1');
    expect(status!.today_board).toHaveLength(2);
    expect(status!.yesterday_champion?.referral_count).toBe(9);
    expect(status!.hall[1].referrer_code).toBe('VIRAL-OLD01');
  });

  it('parseDailyCrownStatus returns null for garbage', () => {
    expect(parseDailyCrownStatus(null)).toBeNull();
    expect(parseDailyCrownStatus('x')).toBeNull();
    expect(parseDailyCrownStatus([])).toBeNull();
  });

  it('dailyCrownFlairCodes includes champion and live leader', () => {
    const status: DailyCrownStatus = {
      timezone: 'UTC',
      today_utc: '2026-08-03',
      window_start: '',
      window_end: '',
      seconds_remaining: 100,
      current_leader: { referrer_code: 'viral-lead1', referral_count: 2 },
      today_board: [],
      yesterday_champion: { referrer_code: 'viral-yest1', referral_count: 5 },
      hall: [],
    };
    const set = dailyCrownFlairCodes(status);
    expect(set.has('VIRAL-LEAD1')).toBe(true);
    expect(set.has('VIRAL-YEST1')).toBe(true);
    expect(dailyCrownFlairCodes(null).size).toBe(0);
  });

  it('formatDailyCrownRaceLine covers empty and leader states', () => {
    const empty = formatDailyCrownRaceLine({
      timezone: 'UTC',
      today_utc: '2026-08-03',
      window_start: '',
      window_end: '',
      seconds_remaining: 120,
      current_leader: null,
      today_board: [],
      yesterday_champion: null,
      hall: [],
    });
    expect(empty).toMatch(/Daily Crown open/i);
    expect(empty).toMatch(/2m/);

    const lead = formatDailyCrownRaceLine({
      timezone: 'UTC',
      today_utc: '2026-08-03',
      window_start: '',
      window_end: '',
      seconds_remaining: 7200,
      current_leader: { referrer_code: 'VIRAL-ACE01', referral_count: 1 },
      today_board: [],
      yesterday_champion: null,
      hall: [],
    });
    expect(lead).toContain('VIRAL-ACE01');
    expect(lead).toMatch(/1 referral/);
  });

  it('share card helpers', () => {
    expect(dailyCrownFilename('VIRAL-X', 'champion')).toBe(
      'viralrefer-daily-crown-champion-viral-x.png',
    );
    const html = buildDailyCrownShareCardHtml({
      code: 'VIRAL-X',
      refs: 3,
      kind: 'champion',
      dayLabel: 'Aug 2, 2026',
    });
    expect(html).toMatch(/Daily Crown/);
    expect(html).toMatch(/data-daily-crown-share="mine"/);
  });
});
