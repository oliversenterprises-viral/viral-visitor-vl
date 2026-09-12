import { hostnameFromUrl, normalizeWebsiteUrl, rungForSite } from '../_lib/engine';
import { json, originFromRequest } from '../_lib/http';
import { loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const raw = url.searchParams.get('site') || '';
  const normalized = normalizeWebsiteUrl(raw.includes('.') ? raw : `https://${raw}`);
  const host = normalized ? hostnameFromUrl(normalized) : null;
  if (!host) return json({ ok: false, error: 'Need a site hostname.' }, { status: 400 });
  const { state, demoMode } = await loadState(env);
  const site = state.sites[host];
  const origin = originFromRequest(request);
  const iframe = `<iframe src="${origin}/e/${encodeURIComponent(host)}" title="Help us go viral" style="width:100%;max-width:420px;height:88px;border:0;border-radius:16px" loading="lazy"></iframe>`;
  const script = `<script async src="${origin}/embed.js" data-site="${host}"></script>`;
  return json({
    ok: true,
    demoMode,
    host,
    known: Boolean(site),
    credits: site?.creditTimes.length ?? 0,
    rung: site ? rungForSite(state, host, Date.now()) : 'entered',
    iframe,
    script,
  });
};
