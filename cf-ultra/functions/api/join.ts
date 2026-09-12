import { emitJoinAlerts, emitSpikeAlert, rememberAlertOrigin } from '../_lib/alerts';
import { recordAnalytics } from '../_lib/analytics';
import { parseCampaign } from '../_lib/campaign';
import { buildBoard, hostnameFromUrl, joinAndMaybeCredit, normalizeReferralCode, normalizeWebsiteUrl, publicPlayer, publicSite, rungForSite } from '../_lib/engine';
import { edgeBust } from '../_lib/edge-cache';
import { actorFromRequest, clientIp, json, originFromRequest, readJson, tooMany, withActor } from '../_lib/http';
import { allowJoin } from '../_lib/limit';
import { isBanned, loadOps } from '../_lib/ops';
import { hintsFromRequest } from '../_lib/stats';
import { buildCleanReferralLink } from '../_lib/referral-url';
import { loadState, saveState, type UltraEnv } from '../_lib/store';

type JoinBody = { url?: string; ref?: string; src?: string; camp?: string; utm?: string };

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env, waitUntil }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const ip = clientIp(request);
  const origin = originFromRequest(request);
  rememberAlertOrigin(origin);
  const limited = allowJoin(ip, actorId);
  if (!limited.ok) {
    const kind = limited.reason === 'global_join_spike' || limited.reason === 'ip_join' ? 'burst_ip' : 'blocked';
    waitUntil(
      recordAnalytics(env, {
        kind,
        actorId,
        hints: hintsFromRequest(request),
        flushNow: false,
        request,
        ip,
      }).then(() => emitSpikeAlert(env, origin, kind === 'burst_ip' ? 'Join burst / 429' : 'Join blocked', ip)),
    );
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
  const ref = normalizeReferralCode(body.ref);
  if (isBanned(ops, ref, host) || (ref && ops.bannedCodes.includes(ref))) {
    const hints = hintsFromRequest(request);
    waitUntil(
      recordAnalytics(env, { kind: 'blocked', actorId, hints, flushNow: true, text: 'Banned code or site', request, ip }).then(() =>
        emitSpikeAlert(env, origin, 'Banned code or site', ip),
      ),
    );
    return withActor(json({ ok: false, error: 'That link or site is paused by the owner.' }, { status: 403 }), actorId, setCookie);
  }
  const camp = parseCampaign({ src: body.src, camp: body.camp, utm: body.utm });
  const outcome = joinAndMaybeCredit(loaded.state, {
    url: body.url ?? '',
    ref,
    actorId,
    trafficExchange: camp.te,
    allowTeCredit: ops.teCreditsCount === true,
  });

  if (!('result' in outcome)) {
    return withActor(json(outcome, { status: 400 }), actorId, setCookie);
  }

  const { state } = outcome;
  const result = outcome.result;
  const save = await saveState(env, state, loaded.demoMode);
  void edgeBust(request, ['/api/board', '/api/activity', '/api/challenge']);
  const hints = hintsFromRequest(request, { src: camp.src, camp: camp.camp, utm: camp.te ? 'te' : body.utm, te: camp.te });
  await recordAnalytics(env, {
    kind: 'join',
    actorId,
    hints,
    flushNow: true,
    text: result.site?.host || result.player.code,
    origin,
    request,
    ip,
  });
  if (result.credited) {
    await recordAnalytics(env, {
      kind: 'credit',
      actorId,
      hints,
      flushNow: true,
      text: result.site?.host || result.player.code,
      origin,
      request,
      ip,
      rung: result.unlock ? { at: Date.now(), host: result.unlock.host, rung: result.unlock.rung } : undefined,
    });
  } else if (result.selfJoin) {
    await recordAnalytics(env, { kind: 'self_ref', actorId, hints, flushNow: true, origin, request, ip });
  } else if (result.teIgnored) {
    await recordAnalytics(env, { kind: 'te_ignored', actorId, hints, flushNow: true, origin, request, ip, text: result.site?.host || result.player.code });
  }

  const now = Date.now();
  const isNewSite = Boolean(host && result.site && !loaded.state.sites[host]);
  const creditHost = result.referrerCode ? state.players[result.referrerCode]?.siteHost : undefined;
  const previousRung = creditHost ? rungForSite(loaded.state, creditHost, now) : 'entered';
  const nextRung = result.unlock?.rung || (creditHost ? rungForSite(state, creditHost, now) : 'entered');
  const creditN = result.referrerCode ? state.players[result.referrerCode]?.creditTimes.length || 0 : 0;
  waitUntil(
    emitJoinAlerts({
      env,
      origin,
      host: result.site?.host || result.player.code,
      isNewSite,
      credited: result.credited,
      creditN,
      creditHost,
      previousRung,
      nextRung,
    }),
  );
  const shareUrl = buildCleanReferralLink(result.player.code, origin);
  const rung = result.site ? rungForSite(state, result.site.host, now) : 'entered';

  return withActor(
    json({
      ok: true,
      demoMode: loaded.demoMode,
      persisted: save.persisted,
      degraded: save.degraded,
      player: publicPlayer(result.player, now),
      site: result.site ? publicSite(result.site, now) : null,
      shareUrl,
      sharePath: result.sharePath,
      rung,
      credited: result.credited,
      alreadyCredited: result.alreadyCredited,
      selfJoin: result.selfJoin,
      referrerCode: result.referrerCode,
      teIgnored: result.teIgnored,
      unlock: result.unlock,
      kingmaker: result.kingmaker,
      board: buildBoard(state, now, loaded.demoMode),
    }),
    actorId,
    setCookie,
  );
};
