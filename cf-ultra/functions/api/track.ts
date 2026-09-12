import { emitAlert, emitSpikeAlert, flushAlertBatches, maybeFirstShareAlert, rememberAlertOrigin } from '../_lib/alerts';
import { recordAnalytics, samplePageview } from '../_lib/analytics';
import { actorFromRequest, json, originFromRequest, readJson, tooMany, withActor } from '../_lib/http';
import { hitLimit } from '../_lib/limit';
import { hintsFromRequest, type TrackKind } from '../_lib/stats';
import type { UltraEnv } from '../_lib/store';

const KINDS = new Set<TrackKind>([
  'pageview',
  'land',
  'paste',
  'share',
  'friend_land',
  'embed_load',
  'embed_click',
  'error',
]);

type Body = { kind?: string; platform?: string; utm?: string; referrer?: string; session?: string; host?: string };

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env, waitUntil }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const origin = originFromRequest(request);
  rememberAlertOrigin(origin);
  const limited = hitLimit(`track:${actorId}`, 40, 60_000);
  if (!limited.ok) {
    waitUntil(emitSpikeAlert(env, origin, 'Track burst / 429'));
    return withActor(tooMany('Track rate limited', limited.retryAfterSec), actorId, setCookie);
  }
  const body = (await readJson<Body>(request)) ?? {};
  const kind = KINDS.has(body.kind as TrackKind) ? (body.kind as TrackKind) : 'pageview';
  if (kind === 'pageview' && !samplePageview(actorId)) {
    return withActor(json({ ok: true, sampled: false }), actorId, setCookie);
  }
  const hints = hintsFromRequest(request, body);
  const host = typeof body.host === 'string' ? body.host.replace(/^www\./, '').slice(0, 120) : '';
  await recordAnalytics(env, {
    kind,
    actorId,
    sessionId: body.session || actorId,
    hints,
    flushNow: kind !== 'pageview' && kind !== 'land',
    text: host || undefined,
    origin,
  });
  if (kind === 'share' && host) {
    waitUntil(maybeFirstShareAlert(env, origin, host).then(() => flushAlertBatches(env, origin)));
  } else if (kind === 'friend_land') {
    waitUntil(
      emitAlert(env, origin, {
        kind: 'friend_land',
        title: 'Friend land',
        body: host ? `${host} via a referral link` : 'Someone opened a referral link',
        host: host || undefined,
        count: 1,
      }).then(() => flushAlertBatches(env, origin)),
    );
  }
  return withActor(json({ ok: true, sampled: true }), actorId, setCookie);
};
