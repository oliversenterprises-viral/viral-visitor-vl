import { buildBoard, publicPlayer, publicSite, rungForSite } from '../_lib/engine';
import { actorFromRequest, json, originFromRequest, withActor } from '../_lib/http';
import { loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const { state, demoMode } = await loadState(env);
  const code = state.actorToCode[actorId];
  const player = code ? state.players[code] : null;
  const site = player ? state.sites[player.siteHost] : null;
  const now = Date.now();
  const origin = originFromRequest(request);
  return withActor(
    json({
      ok: true,
      demoMode,
      player: player ? publicPlayer(player, now) : null,
      site: site ? publicSite(site, now) : null,
      shareUrl: player ? `${origin}/r/${player.code}` : null,
      rung: site ? rungForSite(state, site.host, now) : null,
      board: buildBoard(state, now, demoMode),
    }),
    actorId,
    setCookie,
  );
};
