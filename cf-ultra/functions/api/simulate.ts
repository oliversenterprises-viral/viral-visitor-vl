import { CODE_RE, buildBoard, joinAndMaybeCredit, newActorId, publicPlayer, publicSite, rungForSite } from '../_lib/engine';
import { json, originFromRequest, readJson } from '../_lib/http';
import { kvBound, loadState, saveState, type UltraEnv } from '../_lib/store';

type Body = { code?: string; url?: string };

/**
 * Demo-only: pretends a new unique friend tapped Get my link.
 * Disabled when BOARD KV is bound so production never fabricates locks.
 */
export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  if (kvBound(env)) {
    return json({ ok: false, error: 'Simulate is off when KV is bound. Use a real second browser.' }, { status: 403 });
  }
  const body = (await readJson<Body>(request)) ?? {};
  const code = body.code && CODE_RE.test(body.code) ? body.code : '';
  if (!code) return json({ ok: false, error: 'Need a live share code.' }, { status: 400 });
  const loaded = await loadState(env);
  const player = loaded.state.players[code];
  if (!player) return json({ ok: false, error: 'Unknown share code.' }, { status: 404 });
  const outcome = joinAndMaybeCredit(loaded.state, {
    url: body.url || player.siteUrl,
    ref: code,
    actorId: newActorId(),
  });
  if (!('result' in outcome)) return json(outcome, { status: 400 });
  const { state, result } = outcome;
  await saveState(env, state);
  const now = Date.now();
  return json({
    ok: true,
    demoMode: loaded.demoMode,
    simulated: true,
    player: publicPlayer(state.players[code], now),
    site: publicSite(state.sites[player.siteHost], now),
    shareUrl: `${originFromRequest(request)}/r/${code}`,
    rung: rungForSite(state, player.siteHost, now),
    credited: result.credited,
    unlock: result.unlock,
    kingmaker: result.kingmaker,
    board: buildBoard(state, now, loaded.demoMode),
  });
};
