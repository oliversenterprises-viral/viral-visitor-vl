import { publicPlayer, publicSite, rungForSite } from '../_lib/engine';
import { actorFromRequest, json, originFromRequest, withActor } from '../_lib/http';
import { buildCleanReferralLink } from '../_lib/referral-url';
import { getBoard, loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const { actorId, setCookie } = actorFromRequest(request);
  const [{ state, demoMode }, read] = await Promise.all([loadState(env), getBoard(env)]);
  const code = state.actorToCode[actorId];
  const player = code ? state.players[code] : null;
  const site = player ? state.sites[player.siteHost] : null;
  const now = Date.now();
  const origin = originFromRequest(request);
  return withActor(
    json({
      ok: true,
      demoMode,
      degraded: read.degraded,
      player: player ? publicPlayer(player, now) : null,
      site: site ? publicSite(site, now) : null,
      shareUrl: player ? buildCleanReferralLink(player.code, origin) : null,
      rung: site ? rungForSite(state, site.host, now) : null,
      board: read.board,
    }),
    actorId,
    setCookie,
  );
};
