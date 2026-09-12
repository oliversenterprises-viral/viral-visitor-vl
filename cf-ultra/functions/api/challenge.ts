import { edgeMatch, edgePut, publicCacheKey } from '../_lib/edge-cache';
import { jsonPublic } from '../_lib/http';
import { getBoard, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const key = publicCacheKey(request, '/api/challenge');
  const hit = await edgeMatch(key);
  if (hit) return hit;

  const read = await getBoard(env);
  const res = jsonPublic(
    {
      ok: true,
      demoMode: read.board.demoMode,
      degraded: read.degraded,
      weekId: read.board.weekId,
      race: read.board.race,
      duel: read.board.duel,
      kingmakers: read.board.kingmakers,
    },
    { ttlSec: 3, staleSec: 15, degraded: read.degraded, stale: read.stale },
  );
  await edgePut(key, res.clone());
  return res;
};
