import { isReferralCode } from '../_lib/engine';
import { svg, text } from '../_lib/http';
import { ogImageSvg } from '../_lib/og';
import { getBoard, loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  if (!isReferralCode(code)) return text('bad code', 400);

  try {
    const [loaded, read] = await Promise.all([loadState(env), getBoard(env)]);
    const player = loaded.state.players[code];
    const site = player ? loaded.state.sites[player.siteHost] : undefined;
    const row = [read.board.banner, ...read.board.challenger, ...read.board.rising, ...read.board.entered, ...read.board.race].find(
      (s) => s && (s.ownerCode === code || s.host === player?.siteHost),
    );
    const rankIdx = row ? read.board.race.findIndex((s) => s.host === row.host) : -1;
    return svg(
      ogImageSvg({
        code,
        host: site?.host ?? 'ViralRefer',
        rung: row?.rung ?? 'entered',
        credits: site?.creditTimes.length ?? row?.credits ?? 0,
        weekly: row?.weeklyCredits ?? 0,
        rank: rankIdx >= 0 ? rankIdx + 1 : null,
        demoMode: loaded.demoMode,
        origin: new URL(request.url).origin,
      }),
    );
  } catch {
    return svg(
      ogImageSvg({
        code,
        host: 'ViralRefer',
        rung: 'entered',
        credits: 0,
        weekly: 0,
        demoMode: false,
        origin: new URL(request.url).origin,
      }),
    );
  }
};
