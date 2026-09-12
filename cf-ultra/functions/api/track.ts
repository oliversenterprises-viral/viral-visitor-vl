import { recordAnalytics, samplePageview } from '../_lib/analytics';
import { actorFromRequest, json, readJson, tooMany, withActor } from '../_lib/http';
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

type Body = { kind?: string; platform?: string; utm?: string; referrer?: string; session?: string };

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const limited = hitLimit(`track:${actorId}`, 40, 60_000);
  if (!limited.ok) {
    return withActor(tooMany('Track rate limited', limited.retryAfterSec), actorId, setCookie);
  }
  const body = (await readJson<Body>(request)) ?? {};
  const kind = KINDS.has(body.kind as TrackKind) ? (body.kind as TrackKind) : 'pageview';
  if (kind === 'pageview' && !samplePageview(actorId)) {
    return withActor(json({ ok: true, sampled: false }), actorId, setCookie);
  }
  const hints = hintsFromRequest(request, body);
  await recordAnalytics(env, {
    kind,
    actorId,
    sessionId: body.session || actorId,
    hints,
    flushNow: kind !== 'pageview' && kind !== 'land',
  });
  return withActor(json({ ok: true, sampled: true }), actorId, setCookie);
};
