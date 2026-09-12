/**
 * ViralRefer Ultra — pure game engine (no Cloudflare imports).
 * Unique friend Get-my-link actions climb a site. Visits never count.
 */

export const ENTERED_TTL_MS = 15 * 60 * 1000;
export const RISING_TTL_MS = 60 * 60 * 1000;
export const BANNER_MIN_WEEKLY = 3;
export const CHALLENGER_MIN_WEEKLY = 2;
export const CODE_RE = /^VR-[A-HJ-NP-Z2-9]{6}$/;
export const ACTOR_RE = /^[a-f0-9]{32}$/;
export const MAX_ACTIVITY = 40;
export const MAX_KINGMAKERS = 12;
export const MAX_CREDIT_TIMES = 400;
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type Rung = 'entered' | 'rising' | 'challenger' | 'banner';

export type ActivityType = 'join' | 'credit' | 'rung' | 'banner' | 'kingmaker' | 'duel';

export interface Player {
  code: string;
  siteHost: string;
  siteUrl: string;
  createdAt: number;
  referredBy: string | null;
  creditTimes: number[];
  lastCreditDay: string | null;
  streakDays: number;
  actorId: string;
}

export interface Site {
  host: string;
  url: string;
  label: string;
  ownerCode: string;
  createdAt: number;
  creditTimes: number[];
}

export interface ActivityEvent {
  id: string;
  at: number;
  type: ActivityType;
  text: string;
  host?: string;
}

export interface Kingmaker {
  code: string;
  host: string;
  winnerHost: string;
  winnerLabel: string;
  at: number;
}

export interface UltraState {
  players: Record<string, Player>;
  sites: Record<string, Site>;
  actorToCode: Record<string, string>;
  credits: Record<string, number>;
  activity: ActivityEvent[];
  kingmakers: Kingmaker[];
  bannerHost: string | null;
}

export interface BoardSite {
  host: string;
  url: string;
  label: string;
  credits: number;
  weeklyCredits: number;
  heat: number;
  streak: number;
  rung: Rung;
  expiresAt?: number;
  ownerCode: string;
}

export interface BoardState {
  weekId: string;
  banner: BoardSite | null;
  entered: BoardSite[];
  rising: BoardSite[];
  challenger: BoardSite[];
  race: BoardSite[];
  duel: { a: BoardSite; b: BoardSite; gap: number } | null;
  kingmakers: Kingmaker[];
  activity: ActivityEvent[];
  demoMode: boolean;
  livePlayers: number;
  liveSites: number;
}

export interface JoinInput {
  url: string;
  ref?: string | null;
  actorId: string;
  now?: number;
}

export interface JoinError {
  ok: false;
  error: string;
}

export interface UnlockMoment {
  rung: Rung;
  title: string;
  shareText: string;
  host: string;
}

export interface JoinResult {
  ok: true;
  player: Player;
  site: Site;
  sharePath: string;
  credited: boolean;
  referrerCode: string | null;
  unlock: UnlockMoment | null;
  kingmaker: Kingmaker | null;
  alreadyCredited: boolean;
  selfJoin: boolean;
}

export const RUNG_ORDER: Rung[] = ['entered', 'rising', 'challenger', 'banner'];

export const RUNG_COPY: Record<Rung, { title: string; next: string; share: string }> = {
  entered: {
    title: 'Just entered',
    next: '1 unique friend tap → Rising',
    share: 'I just dropped my site on ViralRefer Ultra. Tap Get my link — visits do not count.',
  },
  rising: {
    title: 'Rising',
    next: '2 unique friends this week → Challenger',
    share: 'We are Rising on ViralRefer Ultra. One more unique friend tap and we hit Challenger.',
  },
  challenger: {
    title: 'Challenger',
    next: '3 unique friends this week + #1 → Banner',
    share: 'Challenger unlocked. Help us take the #1 banner — tap Get my link.',
  },
  banner: {
    title: '#1 Banner',
    next: 'Hold #1 this week. Keep sharing.',
    share: 'We hit the #1 banner on ViralRefer Ultra. Tap Get my link and keep the heat on.',
  },
};

export function createEmptyState(): UltraState {
  return {
    players: {},
    sites: {},
    actorToCode: {},
    credits: {},
    activity: [],
    kingmakers: [],
    bannerHost: null,
  };
}

export function cloneState(state: UltraState): UltraState {
  return JSON.parse(JSON.stringify(state)) as UltraState;
}

export function utcDayId(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** ISO-like week id keyed to Monday 00:00 UTC (matches live Site Drops spirit). */
export function utcWeekId(now: number = Date.now()): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const add = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add));
  return monday.toISOString().slice(0, 10);
}

export function newActorId(random = Math.random): string {
  let out = '';
  for (let i = 0; i < 32; i++) out += ((random() * 16) | 0).toString(16);
  return out;
}

export function newCode(existing: Set<string>, random = Math.random): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    let body = '';
    for (let i = 0; i < 6; i++) body += ALPHABET[(random() * ALPHABET.length) | 0];
    const code = `VR-${body}`;
    if (!existing.has(code)) return code;
  }
  return `VR-${Date.now().toString(36).slice(-6).toUpperCase().padStart(6, 'X')}`;
}

export function newEventId(now: number, random = Math.random): string {
  return `${now.toString(36)}-${((random() * 1e9) | 0).toString(36)}`;
}

export function normalizeWebsiteUrl(raw: unknown): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.length > 2048) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host || host.length > 253) return null;
  if (host === 'localhost' || host.endsWith('.localhost')) {
    u.hash = '';
    return u.toString();
  }
  if (!host.includes('.')) return null;
  if (isPrivateHostname(host)) return null;
  u.hash = '';
  u.hostname = host;
  return u.toString();
}

export function hostnameFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

export function labelFromHost(host: string): string {
  return host.replace(/^www\./, '').slice(0, 48);
}

function isPrivateHostname(host: string): boolean {
  if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function countSince(times: number[], since: number): number {
  let n = 0;
  for (const t of times) if (t >= since) n += 1;
  return n;
}

export function weeklyCredits(times: number[], now: number): number {
  const week = utcWeekId(now);
  let n = 0;
  for (const t of times) if (utcWeekId(t) === week) n += 1;
  return n;
}

export function heat24(times: number[], now: number): number {
  return countSince(times, now - 86_400_000);
}

export function creditKey(referrerCode: string, actorId: string): string {
  return `${referrerCode}:${actorId}`;
}

export function rungRank(rung: Rung): number {
  return RUNG_ORDER.indexOf(rung);
}

export function nextRung(rung: Rung): Rung | null {
  const i = RUNG_ORDER.indexOf(rung);
  return i < 0 || i === RUNG_ORDER.length - 1 ? null : RUNG_ORDER[i + 1];
}

function ownerStreak(state: UltraState, ownerCode: string): number {
  return state.players[ownerCode]?.streakDays ?? 0;
}

export function toBoardSite(state: UltraState, site: Site, now: number, rung: Rung): BoardSite {
  const expiresAt =
    rung === 'entered'
      ? site.createdAt + ENTERED_TTL_MS
      : rung === 'rising' && site.creditTimes.length
        ? site.creditTimes[site.creditTimes.length - 1] + RISING_TTL_MS
        : undefined;
  return {
    host: site.host,
    url: site.url,
    label: site.label,
    credits: site.creditTimes.length,
    weeklyCredits: weeklyCredits(site.creditTimes, now),
    heat: heat24(site.creditTimes, now),
    streak: ownerStreak(state, site.ownerCode),
    rung,
    expiresAt,
    ownerCode: site.ownerCode,
  };
}

export function rankedSites(state: UltraState, now: number): Site[] {
  return Object.values(state.sites).sort((a, b) => {
    const wa = weeklyCredits(a.creditTimes, now);
    const wb = weeklyCredits(b.creditTimes, now);
    if (wb !== wa) return wb - wa;
    if (b.creditTimes.length !== a.creditTimes.length) return b.creditTimes.length - a.creditTimes.length;
    const la = a.creditTimes[a.creditTimes.length - 1] ?? a.createdAt;
    const lb = b.creditTimes[b.creditTimes.length - 1] ?? b.createdAt;
    if (lb !== la) return lb - la;
    return a.createdAt - b.createdAt;
  });
}

export function classifySite(site: Site, rank: number, now: number): Rung | null {
  const weekly = weeklyCredits(site.creditTimes, now);
  if (rank === 1 && weekly >= BANNER_MIN_WEEKLY) return 'banner';
  if ((rank === 2 || rank === 3) && weekly >= CHALLENGER_MIN_WEEKLY) return 'challenger';
  const last = site.creditTimes[site.creditTimes.length - 1];
  if (site.creditTimes.length >= 1 && last && now - last < RISING_TTL_MS) return 'rising';
  if (now - site.createdAt < ENTERED_TTL_MS) return 'entered';
  return null;
}

export function rungForSite(state: UltraState, host: string, now: number): Rung {
  const ranked = rankedSites(state, now);
  const idx = ranked.findIndex((s) => s.host === host);
  if (idx < 0) return 'entered';
  return classifySite(ranked[idx], idx + 1, now) ?? 'entered';
}

export function buildBoard(state: UltraState, now: number, demoMode: boolean): BoardState {
  const weekId = utcWeekId(now);
  const ranked = rankedSites(state, now);
  const bannerList: BoardSite[] = [];
  const entered: BoardSite[] = [];
  const rising: BoardSite[] = [];
  const challenger: BoardSite[] = [];

  ranked.forEach((site, i) => {
    const rung = classifySite(site, i + 1, now);
    if (!rung) return;
    const row = toBoardSite(state, site, now, rung);
    if (rung === 'banner') bannerList.push(row);
    else if (rung === 'challenger') challenger.push(row);
    else if (rung === 'rising') rising.push(row);
    else entered.push(row);
  });

  const race = ranked.slice(0, 8).map((site, i) => {
    const rung = classifySite(site, i + 1, now) ?? 'entered';
    return toBoardSite(state, site, now, rung);
  });

  const duel =
    race.length >= 2
      ? { a: race[0], b: race[1], gap: Math.max(0, race[0].weeklyCredits - race[1].weeklyCredits) }
      : null;

  return {
    weekId,
    banner: bannerList[0] ?? null,
    entered: entered.slice(0, 8),
    rising: rising.slice(0, 6),
    challenger: challenger.slice(0, 2),
    race,
    duel,
    kingmakers: state.kingmakers.slice(0, MAX_KINGMAKERS),
    activity: state.activity.slice(0, MAX_ACTIVITY),
    demoMode,
    livePlayers: Object.keys(state.players).length,
    liveSites: Object.keys(state.sites).length,
  };
}

export function emptyBoard(demoMode: boolean, now: number = Date.now()): BoardState {
  return {
    weekId: utcWeekId(now),
    banner: null,
    entered: [],
    rising: [],
    challenger: [],
    race: [],
    duel: null,
    kingmakers: [],
    activity: [],
    demoMode,
    livePlayers: 0,
    liveSites: 0,
  };
}

function pushActivity(state: UltraState, event: ActivityEvent): void {
  state.activity = [event, ...state.activity].slice(0, MAX_ACTIVITY);
}

function pushCreditTime(times: number[], at: number): number[] {
  return [...times, at].slice(-MAX_CREDIT_TIMES);
}

function bumpStreak(player: Player, now: number): void {
  const day = utcDayId(now);
  if (player.lastCreditDay === day) return;
  const prev = player.lastCreditDay ? Date.parse(`${player.lastCreditDay}T00:00:00.000Z`) : NaN;
  const yesterday = utcDayId(now - 86_400_000);
  if (player.lastCreditDay === yesterday || (Number.isFinite(prev) && day !== player.lastCreditDay)) {
    player.streakDays = player.lastCreditDay === yesterday ? player.streakDays + 1 : 1;
  } else {
    player.streakDays = 1;
  }
  player.lastCreditDay = day;
}

function unlockFor(rung: Rung, host: string, originPath: string): UnlockMoment {
  const copy = RUNG_COPY[rung];
  return {
    rung,
    title: copy.title,
    shareText: `${copy.share} ${originPath}`,
    host,
  };
}

export function joinAndMaybeCredit(
  state: UltraState,
  input: JoinInput,
  random = Math.random,
): { state: UltraState; result: JoinResult } | JoinError {
  const now = input.now ?? Date.now();
  const url = normalizeWebsiteUrl(input.url);
  if (!url) return { ok: false, error: 'Paste a real http(s) website URL.' };
  const host = hostnameFromUrl(url);
  if (!host) return { ok: false, error: 'Could not read that hostname.' };
  if (!ACTOR_RE.test(input.actorId)) return { ok: false, error: 'Missing actor cookie.' };

  const ref = input.ref && CODE_RE.test(input.ref) ? input.ref : null;
  const next = cloneState(state);

  let player = next.actorToCode[input.actorId] ? next.players[next.actorToCode[input.actorId]] : undefined;
  const isNew = !player;

  if (!player) {
    const code = newCode(new Set(Object.keys(next.players)), random);
    player = {
      code,
      siteHost: host,
      siteUrl: url,
      createdAt: now,
      referredBy: ref && ref !== code ? ref : null,
      creditTimes: [],
      lastCreditDay: null,
      streakDays: 0,
      actorId: input.actorId,
    };
    next.players[code] = player;
    next.actorToCode[input.actorId] = code;
  } else {
    player.siteHost = host;
    player.siteUrl = url;
    next.players[player.code] = player;
  }

  let site = next.sites[host];
  if (!site) {
    site = {
      host,
      url,
      label: labelFromHost(host),
      ownerCode: player.code,
      createdAt: now,
      creditTimes: [],
    };
    next.sites[host] = site;
  } else if (site.ownerCode === player.code) {
    site.url = url;
    site.label = labelFromHost(host);
  }

  if (isNew) {
    pushActivity(next, {
      id: newEventId(now, random),
      at: now,
      type: 'join',
      text: `${site.label} just entered the board`,
      host,
    });
  }

  let credited = false;
  let alreadyCredited = false;
  let selfJoin = false;
  let unlock: UnlockMoment | null = null;
  let kingmaker: Kingmaker | null = null;
  let referrerCode: string | null = null;

  if (ref) {
    const referrer = next.players[ref];
    if (!referrer) {
      // stale link — still give the joiner a kit
    } else if (referrer.actorId === input.actorId || referrer.code === player.code) {
      selfJoin = true;
    } else {
      const key = creditKey(ref, input.actorId);
      if (next.credits[key]) {
        alreadyCredited = true;
      } else {
        const beforeBoard = buildBoard(next, now, false);
        const refSite = next.sites[referrer.siteHost];
        const beforeRung = refSite ? rungForSite(next, refSite.host, now) : 'entered';

        next.credits[key] = now;
        referrer.creditTimes = pushCreditTime(referrer.creditTimes, now);
        bumpStreak(referrer, now);
        next.players[ref] = referrer;
        if (refSite) {
          refSite.creditTimes = pushCreditTime(refSite.creditTimes, now);
          next.sites[refSite.host] = refSite;
        }
        credited = true;
        referrerCode = ref;

        const afterRung = refSite ? rungForSite(next, refSite.host, now) : beforeRung;
        pushActivity(next, {
          id: newEventId(now + 1, random),
          at: now,
          type: 'credit',
          text: `Unique friend lock for ${refSite?.label ?? 'a site'}`,
          host: refSite?.host,
        });

        if (refSite && rungRank(afterRung) > rungRank(beforeRung)) {
          unlock = unlockFor(afterRung, refSite.host, `/r/${ref}`);
          pushActivity(next, {
            id: newEventId(now + 2, random),
            at: now,
            type: 'rung',
            text: `${refSite.label} climbed to ${RUNG_COPY[afterRung].title}`,
            host: refSite.host,
          });
        }

        const afterBoard = buildBoard(next, now, false);
        const newBannerHost = afterBoard.banner?.host ?? null;
        if (newBannerHost && newBannerHost !== beforeBoard.banner?.host && newBannerHost !== next.bannerHost) {
          next.bannerHost = newBannerHost;
          const winner = next.sites[newBannerHost];
          pushActivity(next, {
            id: newEventId(now + 3, random),
            at: now,
            type: 'banner',
            text: `${winner?.label ?? newBannerHost} took the #1 banner`,
            host: newBannerHost,
          });
          const winnerOwner = winner ? next.players[winner.ownerCode] : undefined;
          if (winnerOwner?.referredBy && next.players[winnerOwner.referredBy]) {
            const maker = next.players[winnerOwner.referredBy];
            kingmaker = {
              code: maker.code,
              host: maker.siteHost,
              winnerHost: newBannerHost,
              winnerLabel: winner?.label ?? newBannerHost,
              at: now,
            };
            next.kingmakers = [kingmaker, ...next.kingmakers.filter((k) => k.code !== maker.code)].slice(
              0,
              MAX_KINGMAKERS,
            );
            pushActivity(next, {
              id: newEventId(now + 4, random),
              at: now,
              type: 'kingmaker',
              text: `${labelFromHost(maker.siteHost)} introduced #1 ${kingmaker.winnerLabel}`,
              host: maker.siteHost,
            });
          }
        }
      }
    }
  }

  return {
    state: next,
    result: {
      ok: true,
      player,
      site: next.sites[host],
      sharePath: `/r/${player.code}`,
      credited,
      referrerCode,
      unlock,
      kingmaker,
      alreadyCredited,
      selfJoin,
    },
  };
}

export function publicPlayer(player: Player, now: number) {
  return {
    code: player.code,
    siteHost: player.siteHost,
    siteUrl: player.siteUrl,
    createdAt: player.createdAt,
    referredBy: player.referredBy,
    credits: player.creditTimes.length,
    weeklyCredits: weeklyCredits(player.creditTimes, now),
    heat: heat24(player.creditTimes, now),
    streakDays: player.streakDays,
  };
}

export function publicSite(site: Site, now: number) {
  return {
    host: site.host,
    url: site.url,
    label: site.label,
    ownerCode: site.ownerCode,
    createdAt: site.createdAt,
    credits: site.creditTimes.length,
    weeklyCredits: weeklyCredits(site.creditTimes, now),
    heat: heat24(site.creditTimes, now),
  };
}

export function shareMessage(host: string, shareUrl: string, rung: Rung): string {
  return `${RUNG_COPY[rung].share}\n\n${host}\n${shareUrl}`;
}

export type NextAction = {
  friendsNeeded: number;
  label: string;
  nextRung: Rung | null;
};

/** Always-visible “what to do next” copy. Friends = unique Get my link, never visits. */
export function nextActionFor(input: { credits: number; weeklyCredits: number; rung: Rung }): NextAction {
  const { credits, weeklyCredits, rung } = input;
  if (rung === 'banner') {
    return { friendsNeeded: 0, label: 'Hold #1 this week. Keep sharing.', nextRung: null };
  }
  if (weeklyCredits >= BANNER_MIN_WEEKLY) {
    return { friendsNeeded: 0, label: 'You’re in range — keep sharing to take the #1 banner', nextRung: 'banner' };
  }
  if (weeklyCredits >= CHALLENGER_MIN_WEEKLY || rung === 'challenger') {
    const n = Math.max(1, BANNER_MIN_WEEKLY - weeklyCredits);
    return {
      friendsNeeded: n,
      label: n === 1 ? 'Send to 1 more friend this week to unlock the #1 banner' : `Send to ${n} more friends this week to unlock the #1 banner`,
      nextRung: 'banner',
    };
  }
  if (credits >= 1) {
    const n = Math.max(1, CHALLENGER_MIN_WEEKLY - weeklyCredits);
    return {
      friendsNeeded: n,
      label: n === 1 ? 'Send to 1 more friend this week to unlock Challenger' : `Send to ${n} more friends this week to unlock Challenger`,
      nextRung: 'challenger',
    };
  }
  return { friendsNeeded: 1, label: 'Send to 1 friend to unlock Rising', nextRung: 'rising' };
}

export function faviconForHost(host: string): string {
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(value: string): string {
  return escapeHtml(value);
}
