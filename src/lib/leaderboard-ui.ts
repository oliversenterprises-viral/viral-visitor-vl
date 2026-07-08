/**
 * Leaderboard row rendering + live pulse helpers.
 */

import type { LeaderboardEntry } from './types';
import { referralsToNextRank } from './share-gap';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build public leaderboard HTML with gold #1 styling. */
export function buildLeaderboardHtml(
  entries: readonly LeaderboardEntry[],
  options: { myCode?: string | null; highlightCode?: string | null } = {},
): string {
  if (!entries.length) {
    return `<div class="text-center py-8 text-zinc-400 public-empty-state">
      <div class="text-3xl mb-2" aria-hidden="true">🏆</div>
      <p class="font-medium text-zinc-300 mb-1">The board is wide open</p>
      <p class="text-sm mb-4">Be the first referrer on the live leaderboard.</p>
      <button type="button" onclick="getMyReferralLinkInstant()"
        class="text-sm font-semibold px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white transition-all">
        Get my link — claim #1
      </button>
    </div>`;
  }

  const myCode = (options.myCode || options.highlightCode || '').trim().toUpperCase();
  let html = '<div class="space-y-2" id="leaderboard-rows">';

  entries.slice(0, 12).forEach((e, index) => {
    const isLeader = e.rank === 1;
    const isMe = myCode && (e.referrer_code || '').toUpperCase() === myCode;
    const rowClass = [
      'leaderboard-row flex justify-between items-center px-5 py-3 rounded-2xl transition-all duration-300',
      isLeader
        ? 'leaderboard-row--gold bg-gradient-to-r from-amber-500/15 to-yellow-500/5 border border-amber-400/35 shadow-lg shadow-amber-900/20'
        : 'bg-zinc-900/70 border border-white/10 hover:bg-primary/8',
      isMe ? 'ring-2 ring-emerald-400/40' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const rankBadge = isLeader
      ? `<div class="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-sm font-black text-zinc-900" title="#1">👑</div>`
      : `<div class="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">${e.rank}</div>`;

    html += `
      <div class="${rowClass} vr-reveal-row" data-rank="${e.rank}" data-code="${escapeHtml(e.referrer_code)}" style="--vr-stagger:${index}">
        <div class="flex items-center gap-3">
          ${rankBadge}
          <div class="font-mono ${isLeader ? 'text-amber-200' : 'text-emerald-400'}">${escapeHtml(e.referrer_code)}${isMe ? ' <span class="text-[10px] text-emerald-300/80">(you)</span>' : ''}</div>
        </div>
        <div class="font-semibold ${isLeader ? 'text-amber-300' : 'text-emerald-400'}">${e.referral_count} <span class="text-xs text-zinc-400">refs</span></div>
      </div>`;
  });

  html += '</div>';
  return html;
}

/** Gap summary for stats panel when user is on board. */
export function buildRankGapSummary(
  myCode: string,
  myCount: number,
  rank: number | null,
  board: readonly LeaderboardEntry[],
): string {
  if (!rank || rank < 1) return '';
  if (rank === 1) {
    return `<div class="text-xs text-amber-300/90 mt-1 font-medium">👑 Leading the board — defend your spot!</div>`;
  }
  const gap = referralsToNextRank(myCode, myCount, board);
  if (gap == null) return '';
  const target = rank - 1;
  return `<div class="text-xs text-violet-300/90 mt-1">${gap} referral${gap === 1 ? '' : 's'} to reach #${target}</div>`;
}

/** Flash newest row after realtime insert (best-effort DOM). */
export function pulseLeaderboardActivity(code?: string): void {
  const rows = document.querySelectorAll('.leaderboard-row');
  rows.forEach((row) => row.classList.remove('leaderboard-row--pulse'));

  if (code) {
    const match = document.querySelector(
      `.leaderboard-row[data-code="${CSS.escape(code.toUpperCase())}"]`,
    );
    if (match) {
      match.classList.add('leaderboard-row--pulse');
      return;
    }
  }

  const first = document.querySelector('.leaderboard-row');
  first?.classList.add('leaderboard-row--pulse');
}