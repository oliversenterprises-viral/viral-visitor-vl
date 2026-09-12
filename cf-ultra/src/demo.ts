import {
  CODE_RE,
  buildBoard,
  createEmptyState,
  joinAndMaybeCredit,
  newActorId,
  publicPlayer,
  publicSite,
  rungForSite,
  type UltraState,
} from '../functions/_lib/engine';
import type { JoinOk, MeOk } from './types';

const STATE_KEY = 'vr-ultra-demo-state-v1';
const ACTOR_KEY = 'vr-ultra-demo-actor-v1';

function loadState(): UltraState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw) as UltraState;
    return {
      players: parsed.players ?? {},
      sites: parsed.sites ?? {},
      actorToCode: parsed.actorToCode ?? {},
      credits: parsed.credits ?? {},
      activity: parsed.activity ?? [],
      kingmakers: parsed.kingmakers ?? [],
      bannerHost: parsed.bannerHost ?? null,
    };
  } catch {
    return createEmptyState();
  }
}

function saveState(state: UltraState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function demoActorId(): string {
  let id = localStorage.getItem(ACTOR_KEY);
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    id = newActorId();
    localStorage.setItem(ACTOR_KEY, id);
  }
  return id;
}

function packJoin(state: UltraState, code: string, extras: Partial<JoinOk> = {}): JoinOk {
  const now = Date.now();
  const player = state.players[code];
  const site = state.sites[player.siteHost];
  const origin = location.origin;
  return {
    ok: true,
    demoMode: true,
    player: publicPlayer(player, now),
    site: publicSite(site, now),
    shareUrl: `${origin}/r/${player.code}`,
    sharePath: `/r/${player.code}`,
    rung: rungForSite(state, site.host, now),
    credited: false,
    alreadyCredited: false,
    selfJoin: false,
    referrerCode: null,
    unlock: null,
    kingmaker: null,
    board: buildBoard(state, now, true),
    ...extras,
  };
}

export function demoJoin(url: string, ref?: string | null): JoinOk {
  const outcome = joinAndMaybeCredit(loadState(), {
    url,
    ref: ref && CODE_RE.test(ref) ? ref : null,
    actorId: demoActorId(),
  });
  if (!('result' in outcome)) throw new Error(outcome.error);
  saveState(outcome.state);
  const result = outcome.result;
  return packJoin(outcome.state, result.player.code, {
    credited: result.credited,
    alreadyCredited: result.alreadyCredited,
    selfJoin: result.selfJoin,
    referrerCode: result.referrerCode,
    unlock: result.unlock,
    kingmaker: result.kingmaker,
  });
}

export function demoMe(): MeOk {
  const state = loadState();
  const now = Date.now();
  const code = state.actorToCode[demoActorId()];
  const player = code ? state.players[code] : null;
  const site = player ? state.sites[player.siteHost] : null;
  return {
    ok: true,
    demoMode: true,
    player: player ? publicPlayer(player, now) : null,
    site: site ? publicSite(site, now) : null,
    shareUrl: player ? `${location.origin}/r/${player.code}` : null,
    rung: site ? rungForSite(state, site.host, now) : null,
    board: buildBoard(state, now, true),
  };
}

export function demoSimulate(code: string): JoinOk {
  if (!CODE_RE.test(code)) throw new Error('Need a live share code.');
  const loaded = loadState();
  const player = loaded.players[code];
  if (!player) throw new Error('Unknown share code.');
  const outcome = joinAndMaybeCredit(loaded, {
    url: player.siteUrl,
    ref: code,
    actorId: newActorId(),
  });
  if (!('result' in outcome)) throw new Error(outcome.error);
  saveState(outcome.state);
  return packJoin(outcome.state, code, {
    credited: outcome.result.credited,
    unlock: outcome.result.unlock,
    kingmaker: outcome.result.kingmaker,
    simulated: true,
  });
}

export function demoReset(): void {
  localStorage.removeItem(STATE_KEY);
}
