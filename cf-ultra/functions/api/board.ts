import { edgeMatch, edgePut, publicCacheKey } from '../_lib/edge-cache';
import { jsonPublic } from '../_lib/http';
import { loadOps } from '../_lib/ops';
import { getBoard, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const key = publicCacheKey(request, '/api/board');
  const hit = await edgeMatch(key);
  if (hit) return hit;

  const [read, ops] = await Promise.all([getBoard(env), loadOps(env)]);
  const mute = new Set(ops.mutedCodes);
  if (mute.size) {
    const keep = <T extends { ownerCode?: string }>(s: T | null | undefined) => Boolean(s && !mute.has(s.ownerCode || ''));
    read.board.entered = read.board.entered.filter(keep);
    read.board.rising = read.board.rising.filter(keep);
    read.board.challenger = read.board.challenger.filter(keep);
    read.board.race = read.board.race.filter(keep);
    if (read.board.banner && !keep(read.board.banner)) read.board.banner = null;
  }
  const res = jsonPublic(
    { ok: true, board: read.board, stale: read.stale, degraded: read.degraded, cache: read.cache },
    { ttlSec: 3, staleSec: 15, degraded: read.degraded, stale: read.stale },
  );
  await edgePut(key, res.clone());
  return res;
};
