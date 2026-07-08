import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectRankMoves,
  formatRankMoveLabel,
  mergePublicActivityWithRankMoves,
  pushEphemeralRankMoves,
  getEphemeralRankMoves,
  recordLeaderboardRankMoves,
  resetEphemeralRankMoves,
} from '../../src/lib/rank-move-activity';

describe('rank-move-activity', () => {
  beforeEach(() => {
    resetEphemeralRankMoves();
  });

  it('detectRankMoves finds upward movement', () => {
    const moves = detectRankMoves(
      [
        { referrer_code: 'VIRAL-A', referral_count: 5, rank: 2 },
        { referrer_code: 'VIRAL-B', referral_count: 3, rank: 3 },
      ],
      [
        { referrer_code: 'VIRAL-A', referral_count: 6, rank: 1 },
        { referrer_code: 'VIRAL-B', referral_count: 3, rank: 3 },
      ],
      { creditedCode: 'VIRAL-A', at: '2026-06-30T12:00:00Z' },
    );
    expect(moves).toHaveLength(1);
    expect(moves[0]?.referrer_code).toBe('VIRAL-A');
    expect(moves[0]?.new_rank).toBe(1);
  });

  it('detectRankMoves ignores downward movement', () => {
    const moves = detectRankMoves(
      [{ referrer_code: 'VIRAL-A', referral_count: 5, rank: 1 }],
      [{ referrer_code: 'VIRAL-A', referral_count: 5, rank: 2 }],
    );
    expect(moves).toHaveLength(0);
  });

  it('formatRankMoveLabel handles #1 and new entrant', () => {
    expect(
      formatRankMoveLabel({
        kind: 'rank_move',
        referrer_code: 'VIRAL-X',
        created_at: '2026-06-30T12:00:00Z',
        previous_rank: 2,
        new_rank: 1,
      }),
    ).toBe('claimed #1');
    expect(
      formatRankMoveLabel({
        kind: 'rank_move',
        referrer_code: 'VIRAL-Y',
        created_at: '2026-06-30T12:00:00Z',
        previous_rank: null,
        new_rank: 4,
      }),
    ).toBe('entered the board at #4');
  });

  it('mergePublicActivityWithRankMoves puts rank moves near top', () => {
    const merged = mergePublicActivityWithRankMoves(
      [
        {
          kind: 'referral',
          referrer_code: 'VIRAL-A',
          created_at: '2026-06-30T10:00:00Z',
        },
      ],
      [
        {
          kind: 'rank_move',
          referrer_code: 'VIRAL-B',
          created_at: '2026-06-30T12:00:00Z',
          previous_rank: 3,
          new_rank: 2,
        },
      ],
      5,
    );
    expect(merged[0]?.kind).toBe('rank_move');
  });

  it('recordLeaderboardRankMoves stores ephemeral moves', () => {
    recordLeaderboardRankMoves(
      [{ referrer_code: 'VIRAL-Z', referral_count: 1, rank: 2 }],
      [{ referrer_code: 'VIRAL-Z', referral_count: 2, rank: 1 }],
      'VIRAL-Z',
    );
    expect(getEphemeralRankMoves().length).toBeGreaterThan(0);
  });
});