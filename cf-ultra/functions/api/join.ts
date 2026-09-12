import { recordAnalytics } from '../_lib/analytics';
import { CODE_RE, buildBoard, hostnameFromUrl, joinAndMaybeCredit, normalizeWebsiteUrl, publicPlayer, publicSite, rungForSite } from '../_lib/engine';
import { edgeBust } from '../_lib/edge-cache';
import { actorFromRequest, clientIp, json, originFromRequest, readJson, tooMany, withActor } from '../_lib/http';
import { allowJoin } from '../_lib/limit';
import { isBanned, loadOps } from '../_lib/ops';
import { hintsFromRequest } from '../_lib/stats';
import { loadState, saveState, type UltraEnv } from '../_lib/store';

type JoinBody = { url?: string; ref?: string };

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const ip = clientIp(request);
  const limited = allowJoin(ip, actorId);
  if (!limited.ok) {
    await recordAnalytics(env, {
      kind: limited.reason === 'global_join_spike' || limited.reason === 'ip_join' ? 'burst_ip' : 'blocked',
      actorId,
      hints: hintsFromRequest(request),
      flushNow: false,
    });
    return withActor(
      tooMany('Slow down — unique friend taps only. Try again in a moment.', limited.retryAfterSec),
      actorId,
      setCookie,
    );
  }

  const body = (await readJson<JoinBody>(request)) ?? {};
  const loaded = await loadState(env);
  const ops = await loadOps(env);
  const urlNorm = normalizeWebsiteUrl(body.url ?? '');
  const host = urlNorm ? hostnameFromUrl(urlNorm) : null;
  const ref = body.ref && CODE_RE.test(body.ref) ? body.ref : null;
  if (isBanned(ops, ref, host) || (ref && ops.bannedCodes.includes(ref))) {
    const hints = hintsFromRequest(request);
    await recordAnalytics(env, { kind: 'blocked', actorId, hints, flushNow: true, text: 'Banned code or site' });
    return withActor(json({ ok: false, error: 'That link or site is paused by the owner.' }, { status: 403 }), actorId, setCookie);
  }
  const outcome = joinAndMaybeCredit(loaded.state, {
    url: body.url ?? '',
    ref,
    actorId,
  });

  if (!('result' in outcome)) {
    return withActor(json(outcome, { status: 400 }), actorId, setCookie);
  }

  const { state } = outcome;
  const result = outcome.result;
  const save = await saveState(env, state, loaded.demoMode);
  void edgeBust(request, ['/api/board', '/api/activity', '/api/challenge']);
  const hints = hintsFromRequest(request);
  await recordAnalytics(env, {
    kind: 'join',
    actorId,
    hints,
    flushNow: true,
    text: result.site.host,
  });
  if (result.credited) {
    await recordAnalytics(env, {
      kind: 'credit',
      actorId,
      hints,
      flushNow: true,
      text: result.site.host,
      rung: result.unlock ? { at: Date.now(), host: result.unlock.host, rung: result.unlock.rung } : undefined,
    });
  } else if (result.selfJoin) {
    await recordAnalytics(env, { kind: 'self_ref', actorId, hints, flushNow: true });
  }

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
