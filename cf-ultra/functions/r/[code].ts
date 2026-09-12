import { CODE_RE, buildBoard, rungForSite } from '../_lib/engine';
import { html, text } from '../_lib/http';
import { landingHtml } from '../_lib/og';
import { loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ params, request, env }) => {
  const code = String(params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return text('Unknown share link', 404);
  const { state, demoMode } = await loadState(env);
  const player = state.players[code] ?? null;
  if (!player) return text('This share link is not live yet.', 404);
  const site = state.sites[player.siteHost] ?? null;
  const now = Date.now();
  const board = buildBoard(state, now, demoMode);
  const boardSite =
    [board.banner, ...board.challenger, ...board.rising, ...board.entered].find((s) => s && s.host === player.siteHost) ??
    null;
  const origin = new URL(request.url).origin;
  return html(
    landingHtml({
      origin,
      code,
      player,
      site,
      boardSite: boardSite
        ? boardSite
        : site
          ? {
              host: site.host,
              url: site.url,
              label: site.label,
              credits: site.creditTimes.length,
              weeklyCredits: 0,
              heat: 0,
              streak: 0,
              rung: site ? rungForSite(state, site.host, now) : 'entered',
              ownerCode: site.ownerCode,
            }
          : null,
      demoMode,
    }),
  );
};
