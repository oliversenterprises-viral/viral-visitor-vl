/**
 * Daily Crown — no-cash 24h UTC top-referrer incentive UI.
 * Separate from overall #1 homepage feature prize.
 */

import type { LeaderboardEntry } from './types';

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

/** Codes that would have shown crown flair. Zip product never paints that flair. */
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

function paintChampionStrip(): void {
  const strip = document.getElementById('daily-champion-strip');
  if (!strip) return;
  // Zip product: Daily Champion is not the public homepage.
  strip.classList.add('hidden');
  strip.setAttribute('hidden', '');
  strip.innerHTML = '';
}

function paintRaceLine(): void {
  const el = document.getElementById('hero-daily-crown-line');
  if (!el) return;
  // Zip product: never fill the homepage hero with Daily Crown.
  el.classList.add('hidden');
  el.setAttribute('hidden', '');
  el.textContent = '';
}

let cachedStatus: DailyCrownStatus | null = null;

export function getCachedDailyCrownStatus(): DailyCrownStatus | null {
  return cachedStatus;
}

/** Zip product: Daily Crown is not public UI. Cache status only. */
export function renderDailyCrown(
  status: DailyCrownStatus | null,
  _myCode?: string | null,
): void {
  cachedStatus = status;
  const root = document.getElementById('daily-crown-section');
  root?.classList.add('hidden');
  root?.setAttribute('hidden', '');
  if (root) root.innerHTML = '';
  document.getElementById('daily-crown-share-panel')?.classList.add('hidden');
  paintChampionStrip();
  paintRaceLine();
}
