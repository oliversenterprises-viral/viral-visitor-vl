import { hostnameFromUrl, normalizeWebsiteUrl } from '../_lib/engine';
import { edgeMatch, edgePut, publicCacheKey } from '../_lib/edge-cache';
import { html, text } from '../_lib/http';
import { embedWidgetHtml } from '../_lib/og';
import { getBoard, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ params, request, env }) => {
  const raw = decodeURIComponent(String(params.host || ''));
  const normalized = normalizeWebsiteUrl(raw.includes('://') ? raw : `https://${raw}`);
  const host = normalized ? hostnameFromUrl(normalized) : null;
  if (!host) return text('bad host', 400);

  const key = publicCacheKey(request, `/e/${encodeURIComponent(host)}`);
  const hit = await edgeMatch(key);
  if (hit) return hit;

  const read = await getBoard(env);
  const row = [read.board.banner, ...read.board.challenger, ...read.board.rising, ...read.board.entered, ...read.board.race].find(
    (s) => s && s.host === host,
  );
  const page = html(
    embedWidgetHtml({
      origin: new URL(request.url).origin,
      host,
      site: row
        ? {
            host: row.host,
            url: row.url,
            label: row.label,
            ownerCode: row.ownerCode,
            createdAt: 0,
            creditTimes: Array(row.credits).fill(0),
          }
        : null,
      credits: row?.credits ?? 0,
      weekly: row?.weeklyCredits ?? 0,
      rung: row?.rung ?? 'entered',
    }),
    {
      headers: {
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'",
        'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120',
      },
    },
  );
  await edgePut(key, page.clone());
  return page;
};
