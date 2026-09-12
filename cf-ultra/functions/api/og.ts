import { CODE_RE, buildBoard, rungForSite } from '../_lib/engine';
import { svg, text } from '../_lib/http';
import { ogImageSvg } from '../_lib/og';
import { loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  if (!CODE_RE.test(code)) return text('bad code', 400);
  const { state, demoMode } = await loadState(env);
  const player = state.players[code];
  if (!player) return text('unknown link', 404);
  const site = state.sites[player.siteHost];
  const now = Date.now();
  const rung = site ? rungForSite(state, site.host, now) : 'entered';
  const board = buildBoard(state, now, demoMode);
  const row = [board.banner, ...board.challenger, ...board.rising, ...board.entered, ...board.race].find(
    (s) => s && s.host === player.siteHost,
  );
  return svg(
    ogImageSvg({
      host: site?.host ?? 'site',
      rung,
      credits: site?.creditTimes.length ?? 0,
      weekly: row?.weeklyCredits ?? 0,
      demoMode,
    }),
  );
};
