/**
 * Recent activity feed rendering — relative time + live pulse.
 */

import {
  formatSharePlatformLabel,
  type PublicActivityRow,
} from './public-activity';
import { formatRankMoveLabel, type RankMoveActivityRow } from './rank-move-activity';

/** @deprecated Use PublicActivityRow — kept for existing imports */
export type ActivityRow = PublicActivityRow;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Human-readable relative time (e.g. "2m ago"). */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function renderActivityRow(row: PublicActivityRow, index: number): string {
  const fresh = index === 0 ? ' activity-row--fresh' : '';
  const bolt = index === 0 ? '<span class="text-amber-400" aria-hidden="true">⚡</span>' : '';

  if (row.kind === 'share') {
    const platform = formatSharePlatformLabel(row.platform);
    return `
        <div class="activity-row activity-row--share flex justify-between items-center text-xs bg-zinc-900/70 px-4 py-2.5 rounded-2xl border border-white/5${fresh}">
          <span class="font-mono text-violet-300 flex items-center gap-2 flex-wrap">
            ${bolt}
            ${escapeHtml(row.referrer_code)}
            <span class="text-zinc-500 font-sans">shared on ${escapeHtml(platform)}</span>
          </span>
          <span class="text-zinc-400 tabular-nums flex-shrink-0">${formatRelativeTime(row.created_at)}</span>
        </div>`;
  }

  if (row.kind === 'rank_move' && row.new_rank != null) {
    const move = row as RankMoveActivityRow;
    const label = formatRankMoveLabel(move);
    const rankClass = move.new_rank === 1 ? 'text-amber-300' : 'text-amber-200/90';
    return `
        <div class="activity-row activity-row--rank flex justify-between items-center text-xs bg-amber-500/10 px-4 py-2.5 rounded-2xl border border-amber-400/20${fresh}">
          <span class="font-mono ${rankClass} flex items-center gap-2 flex-wrap">
            ${bolt}
            ${escapeHtml(row.referrer_code)}
            <span class="text-zinc-400 font-sans">${escapeHtml(label)}</span>
          </span>
          <span class="text-zinc-400 tabular-nums flex-shrink-0">${formatRelativeTime(row.created_at)}</span>
        </div>`;
  }

  return `
        <div class="activity-row activity-row--referral flex justify-between items-center text-xs bg-zinc-900/70 px-4 py-2.5 rounded-2xl border border-white/5${fresh}">
          <span class="font-mono text-emerald-400 flex items-center gap-2">
            ${bolt}
            ${escapeHtml(row.referrer_code)}
            <span class="text-zinc-500 font-sans">joined</span>
          </span>
          <span class="text-zinc-400 tabular-nums">${formatRelativeTime(row.created_at)}</span>
        </div>`;
}

export function buildRecentActivityHtml(rows: readonly PublicActivityRow[]): string {
  if (!rows.length) {
    return `<div class="text-center py-4 text-zinc-400 text-sm">Referrals and shares from real participants will appear here live.</div>`;
  }

  return rows.map((row, i) => renderActivityRow(row, i)).join('');
}

/** Pulse the freshest activity row after realtime insert. */
export function pulseRecentActivity(): void {
  document.querySelectorAll('.activity-row--fresh').forEach((el) => {
    el.classList.remove('activity-row--fresh');
  });
  const first = document.querySelector('.activity-row');
  first?.classList.add('activity-row--fresh');
}