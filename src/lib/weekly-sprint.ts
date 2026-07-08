/**
 * Weekly sprint board — 7-day mini-leaderboard (separate from main prize).
 */

import type { LeaderboardEntry } from './types';
import { getViralLoopsConfig } from './viral-loops-config';
import { staggerReveal } from './public-polish';
import { trackViralLoopEvent } from './visitor-tracking';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** One-line hero social proof for weekly sprint leader. */
export function formatSprintHeroLine(entries: readonly LeaderboardEntry[]): string {
  const leader = entries[0];
  if (!leader) return '';
  const n = leader.referral_count;
  return `Weekly sprint: ${leader.referrer_code} leads with ${n} referral${n === 1 ? '' : 's'} (7 days)`;
}

export function buildWeeklySprintHtml(
  entries: readonly LeaderboardEntry[],
  myCode?: string | null,
): string {
  if (!entries.length) {
    return `<div class="text-center py-6 text-zinc-400 text-sm public-empty-state">
      <p class="font-medium text-zinc-300 mb-1">Weekly sprint just started</p>
      <p class="mb-3">No 7-day referrals yet — first share wins the sprint board.</p>
      <button type="button" onclick="getMyReferralLinkInstant()"
        class="text-xs font-semibold px-4 py-2 rounded-xl bg-cyan-600/80 hover:bg-cyan-600 text-white">
        Join the sprint
      </button>
    </div>`;
  }

  const me = (myCode || '').trim().toUpperCase();
  let html = '<div class="space-y-2" id="weekly-sprint-rows">';

  entries.slice(0, 8).forEach((e, index) => {
    const isMe = me && (e.referrer_code || '').toUpperCase() === me;
    const isTop = e.rank === 1;
    html += `
      <div class="weekly-sprint-row vr-reveal-row flex justify-between items-center px-4 py-2.5 rounded-xl border transition-all ${
        isTop
          ? 'border-cyan-400/35 bg-cyan-500/10'
          : 'border-white/10 bg-zinc-900/60'
      } ${isMe ? 'ring-1 ring-emerald-400/40' : ''}" data-sprint-rank="${e.rank}" style="--vr-stagger:${index}">
        <div class="flex items-center gap-2.5">
          <span class="w-6 h-6 rounded-full ${isTop ? 'bg-cyan-400 text-zinc-900' : 'bg-violet-600 text-white'} text-[10px] font-bold flex items-center justify-center">${e.rank}</span>
          <span class="font-mono text-sm ${isTop ? 'text-cyan-200' : 'text-emerald-400'}">${escapeHtml(e.referrer_code)}${isMe ? ' <span class="text-[9px] text-emerald-300/80">(you)</span>' : ''}</span>
        </div>
        <span class="text-sm font-semibold ${isTop ? 'text-cyan-300' : 'text-zinc-200'} tabular-nums">${e.referral_count} <span class="text-[10px] text-zinc-500">7d</span></span>
      </div>`;
  });

  html += `</div>
    <p class="text-center text-[11px] text-cyan-300/80 mt-3">
      <button type="button" onclick="document.getElementById('referral-section').scrollIntoView({behavior:'smooth'})"
        class="underline underline-offset-2 decoration-cyan-500/40 hover:text-cyan-200 font-semibold">
        Join the weekly sprint →
      </button>
    </p>`;
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
  staggerReveal(container, '.weekly-sprint-row');
  container.setAttribute('aria-busy', 'false');
  root.classList.remove('hidden');

  if (!sprintTracked) {
    sprintTracked = true;
    trackViralLoopEvent('SprintBoardView', { entries: entries.length });
  }
}