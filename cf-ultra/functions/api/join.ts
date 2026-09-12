import { CODE_RE, buildBoard, joinAndMaybeCredit, publicPlayer, publicSite, rungForSite } from '../_lib/engine';
import { actorFromRequest, clientIp, json, originFromRequest, readJson, withActor } from '../_lib/http';
import { bumpRate, loadState, saveState, type UltraEnv } from '../_lib/store';

type JoinBody = { url?: string; ref?: string };

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const ip = clientIp(request);
  const hits = await bumpRate(env, `join:${ip}`, 60);
  if (hits > 20) {
    return withActor(json({ ok: false, error: 'Slow down — too many joins from this network.' }, { status: 429 }), actorId, setCookie);
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
  await saveState(env, state);
  const now = Date.now();
  const origin = originFromRequest(request);
  const shareUrl = `${origin}${result.sharePath}`;
  const rung = rungForSite(state, result.site.host, now);

  return withActor(
    json({
      ok: true,
      demoMode: loaded.demoMode,
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
