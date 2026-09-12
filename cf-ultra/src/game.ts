import { utcDayId, utcWeekId, type Rung } from '../functions/_lib/engine';

const SOUND_KEY = 'vr-ultra-sound-on';
const STREAK_KEY = 'vr-ultra-share-streak-v1';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Tiny hit. No-op when muted (default) or reduced-motion. */
export function playHit(): void {
  if (!soundEnabled() || prefersReducedMotion()) return;
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 620;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.09);
    o.onended = () => void ctx.close();
  } catch {
    /* no audio */
  }
}

export type BurstTier = 'spark' | 'burst' | 'storm';

export function burstTier(credits: number, unlocked: boolean): BurstTier {
  if (unlocked || credits >= 3) return 'storm';
  if (credits === 2) return 'burst';
  return 'spark';
}

export function celebrationLine(credits: number, host: string, unlocked?: string): string {
  if (unlocked) return `${host} unlocked ${unlocked}. Share this rung while it is hot.`;
  if (credits <= 0) return `${host} is live. Send the /r/ link — one friend tap unlocks Rising.`;
  const lines = [
    `${host} just locked a unique friend.`,
    `Heat spike — ${host} got a real Get my link.`,
    `One more unique tap landed for ${host}.`,
  ];
  return lines[Math.max(0, credits - 1) % lines.length];
}

/** Modal kicker — Site Drops rungs, not SPARK/BURST/STORM. */
export function celebrationKicker(opts: { credits: number; unlock?: string | null }): string {
  const u = (opts.unlock || '').toLowerCase();
  if (u.includes('banner') || u.includes('#1')) return '#1 banner';
  if (u.includes('challenger')) return 'Challenger';
  if (u.includes('rising')) return 'Rising';
  if (opts.credits >= 1) return 'Friend lock';
  return 'Your link';
}

export function bannerScarcity(opts: { held: boolean; weekLabel: string; label?: string }): string {
  if (opts.held) return `${opts.label || '#1'} holds this slot · ${opts.weekLabel}`;
  return `Banner still open · ${opts.weekLabel}`;
}

export function newestActivityText(
  prevId: string | null,
  events: { id: string; text: string }[],
): string | null {
  const first = events[0];
  if (!first || first.id === prevId) return null;
  return first.text;
}

export type ShareStreak = { days: number; lastDay: string; lastAt: number; diesInMs: number; dying: boolean };

export function readShareStreak(now = Date.now()): ShareStreak {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return emptyStreak(now);
    const parsed = JSON.parse(raw) as Partial<ShareStreak>;
    return normalizeStreak(parsed, now);
  } catch {
    return emptyStreak(now);
  }
}

export function bumpShareStreak(now = Date.now()): ShareStreak {
  const prev = readShareStreak(now);
  const today = utcDayId(now);
  const yesterday = utcDayId(now - 86_400_000);
  let days = 1;
  if (prev.lastDay === today) days = Math.max(1, prev.days);
  else if (prev.lastDay === yesterday) days = prev.days + 1;
  const next = normalizeStreak({ days, lastDay: today, lastAt: now }, now);
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ days: next.days, lastDay: next.lastDay, lastAt: next.lastAt }));
  } catch {
    /* ignore */
  }
  return next;
}

function emptyStreak(now: number): ShareStreak {
  return normalizeStreak({ days: 0, lastDay: '', lastAt: 0 }, now);
}

export function normalizeStreak(raw: Partial<ShareStreak>, now = Date.now()): ShareStreak {
  const today = utcDayId(now);
  const yesterday = utcDayId(now - 86_400_000);
  const lastDay = typeof raw.lastDay === 'string' ? raw.lastDay : '';
  const lastAt = Number(raw.lastAt) || 0;
  let days = Number(raw.days) || 0;
  if (lastDay && lastDay !== today && lastDay !== yesterday) days = 0;
  const nextMidnight = Date.parse(`${today}T00:00:00.000Z`) + 86_400_000;
  const diesInMs = Math.max(0, nextMidnight - now);
  const dying = days > 0 && lastDay !== today && diesInMs <= 4 * 3600_000;
  return { days, lastDay, lastAt, diesInMs, dying };
}

export function utcWeekEndMs(now = Date.now()): number {
  const id = utcWeekId(now);
  return Date.parse(`${id}T00:00:00.000Z`) + 7 * 86_400_000;
}

export function weekClockLabel(now = Date.now()): string {
  const ms = Math.max(0, utcWeekEndMs(now) - now);
  const h = Math.floor(ms / 3600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h left this week`;
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `${h}h ${m}m left this week`;
}

/** Live Site Drops hero clock — same wording as viralrefer.app. */
export function weekRaceClock(now = Date.now()): string {
  const ms = Math.max(0, utcWeekEndMs(now) - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `This week's race ends in ${days}d ${hours}h ${mins}m. Send now.`;
}

/** Social-proof pill under the hero CTA. */
export function boardProofLabel(opts: { players: number; leaderWeekly?: number }): string {
  const n = Math.max(0, Math.floor(opts.players));
  const board = n === 1 ? '1 on the live board' : `${n} on the live board`;
  const refs = Math.max(0, Math.floor(opts.leaderWeekly ?? 0));
  if (refs <= 0) return `${board} · #1 is open`;
  return `${board} · #1 has ${refs} referral${refs === 1 ? '' : 's'}`;
}

/** 0–100 heat for the five-rung Site Drop climb. */
export function climbHeatPct(opts: {
  entered: number;
  rising: number;
  textLine: boolean;
  challenger: number;
  banner: boolean;
}): number {
  const lit =
    (opts.entered > 0 ? 1 : 0) +
    (opts.rising > 0 ? 1 : 0) +
    (opts.textLine ? 1 : 0) +
    (opts.challenger > 0 ? 1 : 0) +
    (opts.banner ? 1 : 0);
  return Math.round((lit / 5) * 100);
}

export function progressPct(weekly: number, credits: number, rung: Rung): number {
  if (rung === 'banner') return 100;
  if (credits < 1) return Math.min(90, weekly * 40);
  if (weekly < 2) return 40 + Math.min(40, weekly * 25);
  if (weekly < 3) return 75 + Math.min(20, (weekly - 2) * 20);
  return 92;
}

export function formatDiesIn(ms: number): string {
  const h = Math.max(1, Math.round(ms / 3600_000));
  return h === 1 ? '1h' : `${h}h`;
}

export function risingHook(expiresAt?: number, now = Date.now()): string | null {
  if (!expiresAt || expiresAt <= now) return null;
  const m = Math.max(1, Math.round((expiresAt - now) / 60_000));
  return m >= 60 ? `Your Rising expires in ${Math.round(m / 60)}h — send one more` : `Your Rising expires in ${m}m — send one more`;
}

export function raceGap(opts: { host: string; race: { host: string; weeklyCredits: number; label: string }[]; bannerWeekly?: number }): string | null {
  const idx = opts.race.findIndex((s) => s.host === opts.host);
  if (idx < 0) return null;
  const rank = idx + 1;
  const lead = opts.race[0];
  if (rank === 1) return `#1 this week · hold it`;
  const gap = Math.max(0, (lead?.weeklyCredits ?? 0) - (opts.race[idx]?.weeklyCredits ?? 0));
  return `#${rank} · ${gap} behind ${lead?.label ?? '#1'}`;
}

export function microGoal(
  input: { credits: number; weekly: number; kitOpen: boolean; rung: Rung; joined?: boolean },
  now = Date.now(),
): string {
  if (input.joined === false) {
    const slot = Math.floor(now / 40_000) % 3;
    if (slot === 0) return 'Paste a site — claim your Just entered chip';
    if (slot === 1) return 'No email. Get my link in one tap.';
    return 'Check the board — homepage chips are time-boxed';
  }
  const slot = Math.floor(now / 40_000) % 4;
  if (slot === 0) return input.kitOpen ? 'Copy your link — one friend is the next hit' : 'Open your kit and copy the link';
  if (slot === 1) return 'Send to 1 friend. Visits do not count.';
  if (slot === 2) return 'Check the board — your chip is live on this page';
  return input.rung === 'entered' ? 'Claim Rising: 1 unique Get my link' : 'Keep the heat — one more unique friend';
}

export function ghostCount(liveSites: number, livePlayers: number): string | null {
  if (liveSites <= 0 && livePlayers <= 0) return null;
  const sites = liveSites > 0 ? `${liveSites} live site${liveSites === 1 ? '' : 's'}` : null;
  const players = livePlayers > 0 ? `${livePlayers} in the race` : null;
  return [sites, players].filter(Boolean).join(' · ');
}

export function shareStreakLabel(streak: ShareStreak): string {
  if (streak.days <= 0) return 'Share today to start a streak';
  const base = `Share streak ${streak.days}d`;
  if (streak.dying) return `${base} — dies in ${formatDiesIn(streak.diesInMs)}`;
  if (streak.lastDay) return `${base} · saved`;
  return base;
}

/**
 * Your place on the live 5-rung Site Drop climb (0 = no site yet).
 * 1 Just entered · 2 Rising · 3 Text line · 4 Challenger · 5 Banner
 */
export function yourClimbStep(opts: {
  hasSite: boolean;
  credits: number;
  weekly: number;
  rung: Rung;
}): number {
  if (!opts.hasSite) return 0;
  if (opts.rung === 'banner') return 5;
  if (opts.rung === 'challenger') return 4;
  if (opts.weekly >= 2) return 3;
  if (opts.credits >= 1 || opts.rung === 'rising') return 2;
  return 1;
}

export function nextClimbStep(current: number): number | null {
  if (current < 1) return 1;
  if (current >= 5) return null;
  return current + 1;
}
