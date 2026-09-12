import { recordAnalytics, samplePageview } from '../_lib/analytics';
import { shouldSkipStats } from '../_lib/exclude';
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

type Body = {
  kind?: string;
  platform?: string;
  utm?: string;
  referrer?: string;
  session?: string;
  host?: string;
  src?: string;
  camp?: string;
  te?: boolean;
};

/** Pageview / land / share sampling only. Never enqueue owner alerts. */
export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const limited = hitLimit(`track:${actorId}`, 40, 60_000);
  if (!limited.ok) {
    return withActor(tooMany('Track rate limited', limited.retryAfterSec), actorId, setCookie);
  }
  const skip = await shouldSkipStats(env, request);
  if (skip.skip) {
    return withActor(json({ ok: true, sampled: false, skipped: true, reason: skip.reason }), actorId, setCookie);
  }
  const body = (await readJson<Body>(request)) ?? {};
  const kind = KINDS.has(body.kind as TrackKind) ? (body.kind as TrackKind) : 'pageview';
  if (kind === 'pageview' && !samplePageview(actorId)) {
    return withActor(json({ ok: true, sampled: false }), actorId, setCookie);
  }
  const hints = hintsFromRequest(request, {
    platform: body.platform,
    utm: body.utm,
    referrer: body.referrer,
    src: body.src,
    camp: body.camp,
    te: body.te,
  });
  const host = typeof body.host === 'string' ? body.host.replace(/^www\./, '').slice(0, 120) : '';
  await recordAnalytics(env, {
    kind,
    actorId,
    sessionId: body.session || actorId,
    hints,
    flushNow: kind !== 'pageview' && kind !== 'land',
    text: host || undefined,
    origin: originFromRequest(request),
    request,
    ip: skip.ip,
  });
  return withActor(json({ ok: true, sampled: true }), actorId, setCookie);
};
