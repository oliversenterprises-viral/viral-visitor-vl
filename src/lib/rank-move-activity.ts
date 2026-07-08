/**
 * Phase 2b — leaderboard rank-move events for the public Recent Activity feed.
 */

import type { LeaderboardEntry } from './types';
import type { PublicActivityRow } from './public-activity';

export interface RankMoveActivityRow extends PublicActivityRow {
  kind: 'rank_move';
  previous_rank: number | null;
  new_rank: number;
}

const MAX_EPHEMERAL = 8;
const EPHEMERAL_TTL_MS = 30 * 60 * 1000;

let ephemeralRankMoves: RankMoveActivityRow[] = [];

function normalizeCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

/** Detect positive rank changes between two leaderboard snapshots. */
export function detectRankMoves(
  before: readonly LeaderboardEntry[],
  after: readonly LeaderboardEntry[],
  options: { creditedCode?: string; at?: string; maxMoves?: number } = {},
): RankMoveActivityRow[] {
  const at = options.at ?? new Date().toISOString();
  const maxMoves = options.maxMoves ?? 2;
  const credited = normalizeCode(options.creditedCode || '');

  const beforeMap = new Map(
    before.map((e) => [normalizeCode(e.referrer_code), e.rank]),
  );

  const candidates: RankMoveActivityRow[] = [];

  for (const entry of after.slice(0, 12)) {
    const code = entry.referrer_code;
    const key = normalizeCode(code);
    if (!key) continue;

    const prev = beforeMap.get(key);
    const next = entry.rank;

    if (prev === next) continue;

    if (prev === undefined) {
      if (next <= 10) {
        candidates.push({
          kind: 'rank_move',
          referrer_code: code,
          created_at: at,
          previous_rank: null,
          new_rank: next,
        });
      }
      continue;
    }

    if (next < prev) {
      candidates.push({
        kind: 'rank_move',
        referrer_code: code,
        created_at: at,
        previous_rank: prev,
        new_rank: next,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.new_rank === 1 && b.new_rank !== 1) return -1;
    if (b.new_rank === 1 && a.new_rank !== 1) return 1;
    if (credited) {
      if (normalizeCode(a.referrer_code) === credited) return -1;
      if (normalizeCode(b.referrer_code) === credited) return 1;
    }
    const jumpA = (a.previous_rank ?? 99) - a.new_rank;
    const jumpB = (b.previous_rank ?? 99) - b.new_rank;
    return jumpB - jumpA;
  });

  return candidates.slice(0, maxMoves);
}

/** Human-readable rank move label for activity rows and hero pill. */
export function formatRankMoveLabel(row: RankMoveActivityRow): string {
  if (row.new_rank === 1) return 'claimed #1';
  if (row.previous_rank == null) return `entered the board at #${row.new_rank}`;
  return `moved to #${row.new_rank}`;
}

/** Store short-lived rank moves for the public feed (realtime only). */
export function pushEphemeralRankMoves(moves: readonly RankMoveActivityRow[]): void {
  if (!moves.length) return;
  const now = Date.now();
  for (const move of moves) {
    ephemeralRankMoves.unshift(move);
  }
  ephemeralRankMoves = ephemeralRankMoves.filter((m) => {
    const ts = new Date(m.created_at).getTime();
    return Number.isFinite(ts) && now - ts < EPHEMERAL_TTL_MS;
  });
  if (ephemeralRankMoves.length > MAX_EPHEMERAL) {
    ephemeralRankMoves.length = MAX_EPHEMERAL;
  }
}

export function getEphemeralRankMoves(): readonly RankMoveActivityRow[] {
  return ephemeralRankMoves;
}

/** Merge DB activity with ephemeral rank moves, newest first. */
export function mergePublicActivityWithRankMoves(
  baseRows: readonly PublicActivityRow[],
  rankMoves: readonly RankMoveActivityRow[],
  limit = 8,
): PublicActivityRow[] {
  return [...rankMoves, ...baseRows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

/** Clear ephemeral moves (tests). */
export function resetEphemeralRankMoves(): void {
  ephemeralRankMoves = [];
}

/** Compare leaderboard snapshots after a credited referral and record moves. */
export function recordLeaderboardRankMoves(
  before: readonly LeaderboardEntry[],
  after: readonly LeaderboardEntry[],
  creditedCode?: string,
): RankMoveActivityRow[] {
  const moves = detectRankMoves(before, after, { creditedCode });
  pushEphemeralRankMoves(moves);
  return moves;
}