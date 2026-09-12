import { CODE_RE, type BoardSite } from '../_lib/engine';
import { edgeMatch, edgePut, publicCacheKey } from '../_lib/edge-cache';
import { html, text } from '../_lib/http';
import { landingHtml } from '../_lib/og';
import { getBoard, loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ params, request, env }) => {
  const code = String(params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return text('Unknown share link', 404);

  const key = publicCacheKey(request, `/r/${code}`);
  const hit = await edgeMatch(key);
  if (hit) return hit;

  const origin = new URL(request.url).origin;
  const cacheHeaders = { 'cache-control': 'public, max-age=20, s-maxage=20, stale-while-revalidate=60' };

  try {
    const [{ state, demoMode }, read] = await Promise.all([loadState(env), getBoard(env)]);
    const player = state.players[code] ?? null;
    if (!player) return text('This share link is not live yet.', 404);
    const site = state.sites[player.siteHost] ?? null;
    const boardSite =
      ([read.board.banner, ...read.board.challenger, ...read.board.rising, ...read.board.entered, ...read.board.race].find(
        (s) => s && s.host === player.siteHost,
      ) as BoardSite | undefined) ?? null;
    const page = html(
      landingHtml({
        origin,
        code,
        player,
        site,
        boardSite,
        demoMode,
      }),
      { headers: cacheHeaders },
    );
    await edgePut(key, page.clone());
    return page;
  } catch {
    const fallback = html(
      landingHtml({
        origin,
        code,
        player: null,
        site: null,
        boardSite: null,
        demoMode: false,
      }),
      { headers: { ...cacheHeaders, 'x-ultra-degraded': '1' } },
    );
    return fallback;
  }
};
