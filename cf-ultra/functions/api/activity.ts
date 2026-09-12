import { edgeMatch, edgePut, publicCacheKey } from '../_lib/edge-cache';
import { jsonPublic } from '../_lib/http';
import { getBoard, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const key = publicCacheKey(request, '/api/activity');
  const hit = await edgeMatch(key);
  if (hit) return hit;

  const read = await getBoard(env);
  const res = jsonPublic(
    { ok: true, demoMode: read.board.demoMode, degraded: read.degraded, activity: read.board.activity },
    { ttlSec: 3, staleSec: 15, degraded: read.degraded, stale: read.stale },
  );
  await edgePut(key, res.clone());
  return res;
};
