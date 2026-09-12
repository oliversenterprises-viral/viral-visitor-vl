import { CODE_RE, buildBoard, joinAndMaybeCredit, publicPlayer, publicSite, rungForSite } from '../_lib/engine';
import { edgeBust } from '../_lib/edge-cache';
import { actorFromRequest, clientIp, json, originFromRequest, readJson, tooMany, withActor } from '../_lib/http';
import { allowJoin } from '../_lib/limit';
import { loadState, saveState, type UltraEnv } from '../_lib/store';

type JoinBody = { url?: string; ref?: string };

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const ip = clientIp(request);
  const limited = allowJoin(ip, actorId);
  if (!limited.ok) {
    return withActor(
      tooMany('Slow down — unique friend taps only. Try again in a moment.', limited.retryAfterSec),
      actorId,
      setCookie,
    );
  }

  const body = (await readJson<JoinBody>(request)) ?? {};
  const loaded = await loadState(env);
  const outcome = joinAndMaybeCredit(loaded.state, {
    url: body.url ?? '',
    ref: body.ref && CODE_RE.test(body.ref) ? body.ref : null,
    actorId,
  });

  if (!('result' in outcome)) {
    return withActor(json(outcome, { status: 400 }), actorId, setCookie);
  }

  const { state } = outcome;
  const result = outcome.result;
  const save = await saveState(env, state, loaded.demoMode);
  void edgeBust(request, ['/api/board', '/api/activity', '/api/challenge']);

  const now = Date.now();
  const origin = originFromRequest(request);
  const shareUrl = `${origin}${result.sharePath}`;
  const rung = rungForSite(state, result.site.host, now);

  return withActor(
    json({
      ok: true,
      demoMode: loaded.demoMode,
      persisted: save.persisted,
      degraded: save.degraded,
      player: publicPlayer(result.player, now),
      site: publicSite(result.site, now),
      shareUrl,
      sharePath: result.sharePath,
      rung,
      credited: result.credited,
      alreadyCredited: result.alreadyCredited,
      selfJoin: result.selfJoin,
      referrerCode: result.referrerCode,
      unlock: result.unlock,
      kingmaker: result.kingmaker,
      board: buildBoard(state, now, loaded.demoMode),
    }),
    actorId,
    setCookie,
  );
};
