import { hostnameFromUrl, normalizeWebsiteUrl, rungForSite, weeklyCredits } from '../_lib/engine';
import { html, text } from '../_lib/http';
import { embedWidgetHtml } from '../_lib/og';
import { loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ params, request, env }) => {
  const raw = decodeURIComponent(String(params.host || ''));
  const normalized = normalizeWebsiteUrl(raw.includes('://') ? raw : `https://${raw}`);
  const host = normalized ? hostnameFromUrl(normalized) : null;
  if (!host) return text('bad host', 400);
  const { state } = await loadState(env);
  const site = state.sites[host] ?? null;
  return html(
    embedWidgetHtml({
      origin: new URL(request.url).origin,
      host,
      site,
      credits: site?.creditTimes.length ?? 0,
      weekly: site ? weeklyCredits(site.creditTimes, Date.now()) : 0,
      rung: site ? rungForSite(state, host, Date.now()) : 'entered',
    }),
    { headers: { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'" } },
  );
};
