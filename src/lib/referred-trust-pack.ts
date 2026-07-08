/**
 * Phase 3 — referred-landing trust pack (competition stakes under hero social proof).
 */

import type { LeaderboardEntry } from './types';
import { referralsToNextRank } from './share-gap';

export interface ReferredTrustPackInput {
  board: readonly LeaderboardEntry[];
  uniqueReferrers: number;
  myCode?: string | null;
  myCount?: number;
  myRank?: number | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Main competition line for referred landings. */
export function buildReferredTrustPackMainLine(input: ReferredTrustPackInput): string {
  const competitors = Math.max(input.uniqueReferrers, input.board.length);
  const leader = input.board[0];

  if (competitors <= 0 && !leader) {
    return 'Be the first referrer on the board — wide open';
  }

  const parts: string[] = [];
  parts.push(
    competitors === 1 ? '1 referrer competing' : `${competitors} referrers competing`,
  );

  if (leader) {
    const n = leader.referral_count;
    parts.push(`#1 has ${n} referral${n === 1 ? '' : 's'}`);
  }

  const topCount = leader?.referral_count ?? 0;
  if (topCount <= 5) {
    parts.push('early board is wide open');
  }

  return parts.join(' · ');
}

/** Personal chase line when visitor already has a code. */
export function buildReferredTrustPackPersonalLine(input: ReferredTrustPackInput): string {
  const myCode = (input.myCode || '').trim();
  if (!myCode) return '';

  const myCount = input.myCount ?? 0;
  const myRank = input.myRank ?? null;

  if (myRank === 1) return "You're #1 — defend your spot";

  if (myRank && myRank > 1) {
    const gap = referralsToNextRank(myCode, myCount, input.board);
    if (gap != null && gap > 0) {
      const target = myRank - 1;
      return `${gap} referral${gap === 1 ? '' : 's'} to reach #${target}`;
    }
  }

  if (myCount > 0 && !myRank && input.board.length > 0) {
    const last = input.board[input.board.length - 1];
    if (last) {
      const gap = last.referral_count - myCount + 1;
      if (gap > 0) {
        return `${gap} referral${gap === 1 ? '' : 's'} to reach the leaderboard`;
      }
    }
  }

  if (myCount === 0) {
    return 'Get your link — 1 referral puts you in the race';
  }

  return '';
}

/** Full trust pack HTML — empty when main line missing. */
export function buildReferredTrustPackHtml(input: ReferredTrustPackInput): string {
  const main = buildReferredTrustPackMainLine(input);
  if (!main) return '';

  const personal = buildReferredTrustPackPersonalLine(input);
  const personalHtml = personal
    ? `<div class="text-[11px] text-emerald-300/90 mt-1.5">${escapeHtml(personal)}</div>`
    : '';

  return `<div class="referred-trust-pack rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3">
    <div class="text-xs text-zinc-200/95 leading-relaxed">${escapeHtml(main)}</div>
    ${personalHtml}
  </div>`;
}