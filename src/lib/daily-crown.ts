/**
 * Daily Crown — no-cash 24h UTC top-referrer incentive UI.
 * Separate from overall #1 homepage feature prize.
 */

import type { LeaderboardEntry } from './types';
import { getViralLoopsConfig } from './viral-loops-config';
import { staggerReveal } from './public-polish';
import { trackViralLoopEvent } from './visitor-tracking';
import {
  buildDailyCrownShareCardHtml,
  downloadDailyCrownCard,
  type DailyCrownCardSpec,
} from './daily-crown-card';

export interface DailyCrownPerson {
  referrer_code: string;
  referral_count: number;
  rank?: number;
  day_utc?: string;
}

export interface DailyCrownStatus {
  timezone: string;
  today_utc: string;
  window_start: string;
  window_end: string;
  seconds_remaining: number;
  current_leader: DailyCrownPerson | null;
  today_board: LeaderboardEntry[];
  yesterday_champion: DailyCrownPerson | null;
  hall: DailyCrownPerson[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Codes that should show crown flair on the main leaderboard (24h champion + live day leader). */
export function dailyCrownFlairCodes(status: DailyCrownStatus | null | undefined): Set<string> {
  const set = new Set<string>();
  if (!status) return set;
  const y = status.yesterday_champion?.referrer_code?.trim().toUpperCase();
  if (y) set.add(y);
  const live = status.current_leader?.referrer_code?.trim().toUpperCase();
  if (live) set.add(live);
  return set;
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatCrownDay(dayUtc: string | undefined): string {
  if (!dayUtc) return '';
  // day_utc may be "2026-08-02" or ISO
  const d = dayUtc.slice(0, 10);
  const parts = d.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return d;
  const [y, mo, da] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[(mo || 1) - 1] || '—';
  return `${mon} ${da}, ${y}`;
}

/** Hero / strip one-liner for live race. */
export function formatDailyCrownRaceLine(status: DailyCrownStatus | null | undefined): string {
  if (!status) return '';
  const leader = status.current_leader;
  if (!leader?.referrer_code) {
    return `Daily Crown open — first verified referral today (UTC) takes the lead · resets in ${formatCountdown(status.seconds_remaining)}`;
  }
  const n = leader.referral_count;
  return `Daily Crown race: ${leader.referrer_code} leads with ${n} referral${n === 1 ? '' : 's'} today · ${formatCountdown(status.seconds_remaining)} left (UTC)`;
}

export function parseDailyCrownStatus(raw: unknown): DailyCrownStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const parsePerson = (v: unknown): DailyCrownPerson | null => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const p = v as Record<string, unknown>;
    const code = String(p.referrer_code || '').trim();
    if (!code) return null;
    const count = typeof p.referral_count === 'number' ? p.referral_count : Number(p.referral_count);
    return {
      referrer_code: code,
      referral_count: Number.isFinite(count) ? count : 0,
      rank: typeof p.rank === 'number' ? p.rank : undefined,
      day_utc: p.day_utc != null ? String(p.day_utc).slice(0, 10) : undefined,
    };
  };

  const parseBoard = (v: unknown): LeaderboardEntry[] => {
    if (!Array.isArray(v)) return [];
    return v
      .map((row, i) => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        const code = String(r.referrer_code || '').trim();
        if (!code) return null;
        const count = typeof r.referral_count === 'number' ? r.referral_count : Number(r.referral_count);
        const rank = typeof r.rank === 'number' ? r.rank : i + 1;
        return {
          referrer_code: code,
          referral_count: Number.isFinite(count) ? count : 0,
          rank,
        } satisfies LeaderboardEntry;
      })
      .filter((x): x is LeaderboardEntry => x != null);
  };

  const parseHall = (v: unknown): DailyCrownPerson[] => {
    if (!Array.isArray(v)) return [];
    return v
      .map((row) => parsePerson(row))
      .filter((x): x is DailyCrownPerson => x != null);
  };

  return {
    timezone: String(o.timezone || 'UTC'),
    today_utc: String(o.today_utc || '').slice(0, 10),
    window_start: String(o.window_start || ''),
    window_end: String(o.window_end || ''),
    seconds_remaining:
      typeof o.seconds_remaining === 'number'
        ? o.seconds_remaining
        : Number(o.seconds_remaining) || 0,
    current_leader: parsePerson(o.current_leader),
    today_board: parseBoard(o.today_board),
    yesterday_champion: parsePerson(o.yesterday_champion),
    hall: parseHall(o.hall),
  };
}

function buildTodayRaceHtml(
  board: readonly LeaderboardEntry[],
  myCode?: string | null,
): string {
  if (!board.length) {
    return `<div class="text-center py-4 text-zinc-400 text-sm">
      <p class="font-medium text-zinc-300 mb-1">Crown race is open</p>
      <p class="mb-3 text-xs">No verified referrals yet today (UTC). Be first.</p>
      <button type="button" onclick="getMyReferralLinkInstant()"
        class="text-xs font-semibold px-4 py-2 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-zinc-900">
        Get my link — chase the crown
      </button>
    </div>`;
  }

  const me = (myCode || '').trim().toUpperCase();
  let html = '<div class="space-y-1.5" id="daily-crown-race-rows">';
  board.slice(0, 6).forEach((e, index) => {
    const isMe = me && (e.referrer_code || '').toUpperCase() === me;
    const isTop = e.rank === 1;
    html += `
      <div class="daily-crown-row vr-reveal-row flex justify-between items-center px-3 py-2 rounded-xl border transition-all ${
        isTop
          ? 'border-amber-400/40 bg-amber-500/10'
          : 'border-white/10 bg-zinc-900/50'
      } ${isMe ? 'ring-1 ring-emerald-400/40' : ''}" data-crown-rank="${e.rank}" style="--vr-stagger:${index}">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full ${isTop ? 'bg-amber-400 text-zinc-900' : 'bg-violet-600 text-white'} text-[10px] font-bold flex items-center justify-center" aria-hidden="true">${isTop ? '👑' : e.rank}</span>
          <span class="font-mono text-sm ${isTop ? 'text-amber-200' : 'text-emerald-400'}">${escapeHtml(e.referrer_code)}${isMe ? ' <span class="text-[9px] text-emerald-300/80">(you)</span>' : ''}</span>
          ${isTop ? '<span class="text-[9px] font-bold uppercase tracking-wide text-amber-300/90 px-1.5 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/10">Daily lead</span>' : ''}
        </div>
        <span class="text-sm font-semibold ${isTop ? 'text-amber-300' : 'text-zinc-200'} tabular-nums">${e.referral_count} <span class="text-[10px] text-zinc-500">today</span></span>
      </div>`;
  });
  html += '</div>';
  return html;
}

function buildHallHtml(hall: readonly DailyCrownPerson[]): string {
  if (!hall.length) {
    return `<p class="text-sm text-zinc-500 text-center py-4">Hall of Crowns fills as each UTC day closes. Win a day — your name stays forever.</p>`;
  }
  let html = '<div class="space-y-1.5" id="hall-of-crowns-rows">';
  hall.forEach((h, index) => {
    html += `
      <div class="hall-crown-row vr-reveal-row flex justify-between items-center px-3 py-2 rounded-xl border border-white/10 bg-zinc-900/40" style="--vr-stagger:${index}">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-amber-400 text-sm" aria-hidden="true">👑</span>
          <span class="font-mono text-sm text-amber-100/95 truncate">${escapeHtml(h.referrer_code)}</span>
          <span class="text-[10px] text-zinc-500 shrink-0">${escapeHtml(formatCrownDay(h.day_utc))}</span>
        </div>
        <span class="text-xs font-semibold text-zinc-300 tabular-nums shrink-0">${h.referral_count} refs</span>
      </div>`;
  });
  html += '</div>';
  return html;
}

function paintChampionStrip(_status: DailyCrownStatus): void {
  const strip = document.getElementById('daily-champion-strip');
  if (!strip) return;
  // Zip product: Daily Champion is not the public homepage.
  strip.classList.add('hidden');
  strip.setAttribute('hidden', '');
  strip.innerHTML = '';
}

function paintRaceLine(_status: DailyCrownStatus): void {
  const el = document.getElementById('hero-daily-crown-line');
  if (!el) return;
  // Zip product: never fill the homepage hero with Daily Crown.
  el.classList.add('hidden');
  el.setAttribute('hidden', '');
  el.textContent = '';
}

let crownTracked = false;
let cachedStatus: DailyCrownStatus | null = null;

export function getCachedDailyCrownStatus(): DailyCrownStatus | null {
  return cachedStatus;
}

/** Full UI paint for Daily Crown sections. */
export function renderDailyCrown(
  status: DailyCrownStatus | null,
  myCode?: string | null,
): void {
  cachedStatus = status;
  const root = document.getElementById('daily-crown-section');
  const raceContainer = document.getElementById('daily-crown-race-container');
  const hallContainer = document.getElementById('hall-of-crowns-container');
  const countdownEl = document.getElementById('daily-crown-countdown');

  if (!getViralLoopsConfig().daily_crown_enabled) {
    root?.classList.add('hidden');
    document.getElementById('daily-champion-strip')?.classList.add('hidden');
    document.getElementById('hero-daily-crown-line')?.classList.add('hidden');
    return;
  }

  if (!status) {
    root?.classList.add('hidden');
    document.getElementById('daily-champion-strip')?.classList.add('hidden');
    document.getElementById('hero-daily-crown-line')?.classList.add('hidden');
    return;
  }

  paintChampionStrip(status);
  paintRaceLine(status);

  if (countdownEl) {
    countdownEl.textContent = formatCountdown(status.seconds_remaining);
  }

  if (raceContainer) {
    raceContainer.innerHTML = buildTodayRaceHtml(status.today_board, myCode);
    staggerReveal(raceContainer, '.daily-crown-row');
    raceContainer.setAttribute('aria-busy', 'false');
  }

  if (hallContainer) {
    hallContainer.innerHTML = buildHallHtml(status.hall);
    staggerReveal(hallContainer, '.hall-crown-row');
    hallContainer.setAttribute('aria-busy', 'false');
  }

  // Share card CTA panel
  const sharePanel = document.getElementById('daily-crown-share-panel');
  if (sharePanel) {
    const me = (myCode || '').trim().toUpperCase();
    const isLiveLead =
      !!me && status.current_leader?.referrer_code?.toUpperCase() === me;
    const isChamp =
      !!me && status.yesterday_champion?.referrer_code?.toUpperCase() === me;
    if (isLiveLead || isChamp) {
      const kind = isChamp && !isLiveLead ? 'champion' : 'leader';
      const person = isLiveLead ? status.current_leader! : status.yesterday_champion!;
      sharePanel.innerHTML = buildDailyCrownShareCardHtml({
        code: person.referrer_code,
        refs: person.referral_count,
        kind,
        dayLabel: isChamp
          ? formatCrownDay(status.yesterday_champion?.day_utc)
          : formatCrownDay(status.today_utc),
      });
      sharePanel.classList.remove('hidden');
    } else {
      sharePanel.innerHTML = '';
      sharePanel.classList.add('hidden');
    }
  }

  root?.classList.remove('hidden');
  wireShareButtons(status, myCode);

  if (!crownTracked) {
    crownTracked = true;
    trackViralLoopEvent('DailyCrownView', {
      has_leader: !!status.current_leader,
      has_champion: !!status.yesterday_champion,
      hall: status.hall.length,
    });
  }
}

function wireShareButtons(status: DailyCrownStatus, myCode?: string | null): void {
  const handlers: Array<{ el: Element; spec: DailyCrownCardSpec }> = [];

  document.querySelectorAll('[data-daily-crown-share]').forEach((el) => {
    const kind = el.getAttribute('data-daily-crown-share');
    if (kind === 'champion' && status.yesterday_champion) {
      handlers.push({
        el,
        spec: {
          code: status.yesterday_champion.referrer_code,
          refs: status.yesterday_champion.referral_count,
          kind: 'champion',
          dayLabel: formatCrownDay(status.yesterday_champion.day_utc),
        },
      });
    }
    if (kind === 'leader' && status.current_leader) {
      handlers.push({
        el,
        spec: {
          code: status.current_leader.referrer_code,
          refs: status.current_leader.referral_count,
          kind: 'leader',
          dayLabel: formatCrownDay(status.today_utc),
        },
      });
    }
    if (kind === 'mine' && myCode) {
      const me = myCode.trim().toUpperCase();
      const live = status.current_leader?.referrer_code?.toUpperCase() === me;
      const champ = status.yesterday_champion?.referrer_code?.toUpperCase() === me;
      if (live && status.current_leader) {
        handlers.push({
          el,
          spec: {
            code: status.current_leader.referrer_code,
            refs: status.current_leader.referral_count,
            kind: 'leader',
            dayLabel: formatCrownDay(status.today_utc),
          },
        });
      } else if (champ && status.yesterday_champion) {
        handlers.push({
          el,
          spec: {
            code: status.yesterday_champion.referrer_code,
            refs: status.yesterday_champion.referral_count,
            kind: 'champion',
            dayLabel: formatCrownDay(status.yesterday_champion.day_utc),
          },
        });
      }
    }
  });

  handlers.forEach(({ el, spec }) => {
    const btn = el as HTMLButtonElement;
    btn.onclick = () => {
      void downloadDailyCrownCard(spec).then((ok) => {
        if (ok) {
          trackViralLoopEvent('DailyCrownShare', { kind: spec.kind, code: spec.code });
        }
      });
    };
  });
}
