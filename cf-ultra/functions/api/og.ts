import { CODE_RE } from '../_lib/engine';
import { svg, text } from '../_lib/http';
import { ogImageSvg } from '../_lib/og';
import { getBoard, loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  if (!CODE_RE.test(code)) return text('bad code', 400);

  try {
    const [loaded, read] = await Promise.all([loadState(env), getBoard(env)]);
    const player = loaded.state.players[code];
    if (!player) return text('unknown link', 404);
    const site = loaded.state.sites[player.siteHost];
    const row = [read.board.banner, ...read.board.challenger, ...read.board.rising, ...read.board.entered, ...read.board.race].find(
      (s) => s && s.host === player.siteHost,
    );
    return svg(
      ogImageSvg({
        host: site?.host ?? 'site',
        rung: row?.rung ?? 'entered',
        credits: site?.creditTimes.length ?? row?.credits ?? 0,
        weekly: row?.weeklyCredits ?? 0,
        demoMode: loaded.demoMode,
      }),
    );
  } catch {
    return svg(ogImageSvg({ host: 'viralrefer ultra', rung: 'entered', credits: 0, weekly: 0, demoMode: false }));
  }
};
