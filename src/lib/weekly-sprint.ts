/**
 * Weekly sprint board — 7-day mini-leaderboard (separate from main prize).
 */

import type { LeaderboardEntry } from './types';
import { getViralLoopsConfig } from './viral-loops-config';
import { trackViralLoopEvent } from './visitor-tracking';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildWeeklySprintHtml(
  entries: readonly LeaderboardEntry[],
  myCode?: string | null,
): string {
  if (!entries.length) {
    return `<div class="text-center py-6 text-zinc-400 text-sm">No sprint referrals yet this week — be the first!</div>`;
  }

  const me = (myCode || '').trim().toUpperCase();
  let html = '<div class="space-y-2" id="weekly-sprint-rows">';

  entries.slice(0, 8).forEach((e) => {
    const isMe = me && (e.referrer_code || '').toUpperCase() === me;
    const isTop = e.rank === 1;
    html += `
      <div class="weekly-sprint-row flex justify-between items-center px-4 py-2.5 rounded-xl border transition-all ${
        isTop
          ? 'border-cyan-400/35 bg-cyan-500/10'
          : 'border-white/10 bg-zinc-900/60'
      } ${isMe ? 'ring-1 ring-emerald-400/40' : ''}" data-sprint-rank="${e.rank}">
        <div class="flex items-center gap-2.5">
          <span class="w-6 h-6 rounded-full ${isTop ? 'bg-cyan-400 text-zinc-900' : 'bg-violet-600 text-white'} text-[10px] font-bold flex items-center justify-center">${e.rank}</span>
          <span class="font-mono text-sm ${isTop ? 'text-cyan-200' : 'text-emerald-400'}">${escapeHtml(e.referrer_code)}${isMe ? ' <span class="text-[9px] text-emerald-300/80">(you)</span>' : ''}</span>
        </div>
        <span class="text-sm font-semibold ${isTop ? 'text-cyan-300' : 'text-zinc-200'} tabular-nums">${e.referral_count} <span class="text-[10px] text-zinc-500">7d</span></span>
      </div>`;
  });

  html += '</div>';
  return html;
}

let sprintTracked = false;

/** Render weekly sprint section. */
export function renderWeeklySprintBoard(
  entries: readonly LeaderboardEntry[],
  myCode?: string | null,
): void {
  const root = document.getElementById('weekly-sprint-board');
  const container = document.getElementById('weekly-sprint-container');
  if (!root || !container) return;

  if (!getViralLoopsConfig().sprint_enabled) {
    root.classList.add('hidden');
    return;
  }

  container.innerHTML = buildWeeklySprintHtml(entries, myCode);
  root.classList.remove('hidden');

  if (!sprintTracked) {
    sprintTracked = true;
    trackViralLoopEvent('SprintBoardView', { entries: entries.length });
  }
}