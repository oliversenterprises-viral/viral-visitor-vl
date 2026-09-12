import { isSocialCrawler } from './crawler';
import type { BoardSite } from './engine';
import { normalizeReferralCode } from './engine';
import { html, text } from './http';
import { crawlerOgHtml } from './og';
import { buildCleanReferralLink } from './referral-url';
import { getBoard, loadState, type UltraEnv } from './store';

export type ReferralEnv = UltraEnv & {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
};

/**
 * Live scheme: humans on /r/CODE or /a/CODE see the Site Drops homepage
 * (same SPA, URL stays /r/… or /a/…). Crawlers get OG that shows the VIRAL- code.
 */
export async function serveReferralPath(
  request: Request,
  env: ReferralEnv,
  rawCode: string,
  pathKind: 'r' | 'a',
): Promise<Response> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return text('Unknown share link', 404);

  const origin = new URL(request.url).origin;
  const ua = request.headers.get('user-agent') || '';

  if (!isSocialCrawler(ua)) {
    if (env.ASSETS) {
      const home = new URL('/', request.url);
      return env.ASSETS.fetch(new Request(home.toString(), request));
    }
    const dest = new URL('/', request.url);
    dest.searchParams.set('ref', code);
    return Response.redirect(dest.toString(), 302);
  }

  let host = '';
  let label = '';
  let credits = 0;
  let weekly = 0;
  let rank: number | null = null;
  let demoMode = false;

  try {
    const [{ state, demoMode: dm }, read] = await Promise.all([loadState(env), getBoard(env)]);
    demoMode = dm;
    const player = state.players[code] ?? null;
    const site = player ? (state.sites[player.siteHost] ?? null) : null;
    host = site?.host ?? '';
    label = site?.label ?? host;
    credits = site?.creditTimes.length ?? player?.creditTimes.length ?? 0;
    const row = (
      [read.board.banner, ...read.board.challenger, ...read.board.rising, ...read.board.entered, ...read.board.race].find(
        (s) => s && (s.ownerCode === code || s.host === player?.siteHost),
      ) as BoardSite | undefined
    ) ?? null;
    weekly = row?.weeklyCredits ?? 0;
    if (row) {
      const idx = read.board.race.findIndex((s) => s.host === row.host);
      rank = idx >= 0 ? idx + 1 : null;
    }
  } catch {
    /* crawler still gets a card with the code */
  }

  const canonical = buildCleanReferralLink(code, origin);
  const requested = `${origin}/${pathKind}/${code}`;
  return html(
    crawlerOgHtml({
      origin,
      code,
      canonicalUrl: canonical,
      ogUrl: requested,
      host,
      label,
      credits,
      weekly,
      rank,
      demoMode,
    }),
    {
      headers: {
        'cache-control': 'public, max-age=20, s-maxage=20, stale-while-revalidate=60',
      },
    },
  );
}
