import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderOwnerFunnelDeskView } from '../../src/admin/owner-funnel-desk';
import {
  emptyOwnerFunnelGsc,
  formatGscCount,
  formatGscPosition,
  GSC_CONSOLE_URL,
  GSC_EDGE_SECRET_NAMES,
  GSC_CACHED_NOTE,
  GSC_MISSING_NOTE,
  GSC_PROPERTY,
  GSC_TIMEOUT_NOTE,
  parseOwnerFunnelGsc,
  readGscServerSecret,
  readGscSiteUrl,
  rememberOkGsc,
  resetGscOkCache,
  resolveOwnerFunnelGsc,
  resolveOwnerFunnelGscTimed,
  withTimeout,
} from '../../src/admin/owner-funnel-desk-helpers';

const root = resolve(import.meta.dirname, '../..');

function deskMetrics(gsc?: ReturnType<typeof emptyOwnerFunnelGsc>) {
  return {
    windowDays: 7,
    visits: 0,
    friendLandings: 0,
    landings: 0,
    getLink: 0,
    share: 0,
    locked: 0,
    getLinkRate: '0%',
    feed: [],
    ...(gsc ? { gsc } : {}),
  };
}

describe('owner funnel GSC tracker', () => {
  it('paints the Google Search · tools & pages card with six desk tiles unchanged', () => {
    const el = document.createElement('div');
    renderOwnerFunnelDeskView(el, deskMetrics());
    expect(el.querySelector('[data-owner-desk-gsc]')).not.toBeNull();
    expect(el.querySelector('[data-gsc-status]')?.getAttribute('data-gsc-status')).toBe(
      'missing_credentials',
    );
    expect(el.textContent).toMatch(/Google Search · tools & pages/);
    expect(el.textContent).toMatch(/Clicks/);
    expect(el.textContent).toMatch(/Shown in Google/);
    expect(el.textContent).toMatch(/Tap rate/);
    expect(el.textContent).toMatch(/Avg position/);
    expect(el.textContent).toMatch(/Tool pages/);
    expect(el.textContent).toMatch(/Top searches/);
    expect(el.textContent).toMatch(/Other pages/);
    expect(el.textContent).toMatch(/Search countries/);
    expect(el.textContent).toMatch(/Search Console performance/);
    expect(el.querySelector('[data-owner-desk-gsc-console]')?.getAttribute('href')).toBe(
      GSC_CONSOLE_URL,
    );
    expect(el.textContent).toContain(GSC_PROPERTY);
    expect(el.querySelectorAll('[data-owner-desk-tiles] article').length).toBe(6);
    expect(el.querySelectorAll('[data-owner-desk-gsc-tiles] article').length).toBe(4);
    expect(el.textContent).not.toMatch(/Website|Prize|Promoters/);
  });

  it('uses the verified missing_credentials note and dashes until the server has a key', () => {
    expect(GSC_MISSING_NOTE).toBe(
      'Search Console is verified. Numbers load from the server GSC_SERVICE_ACCOUNT_JSON secret.',
    );
    const empty = emptyOwnerFunnelGsc();
    expect(empty.status).toBe('missing_credentials');
    expect(empty.note).toBe(GSC_MISSING_NOTE);
    expect(formatGscCount(12, 'missing_credentials')).toBe('—');
    expect(formatGscCount(12, 'error')).toBe('—');
    expect(formatGscCount(12, 'timeout')).toBe('—');
    expect(formatGscCount(12, 'ok')).toBe('12');
    expect(formatGscCount(12, 'ok-cached')).toBe('12');
    expect(formatGscPosition(null)).toBe('—');
    expect(formatGscPosition(4.2)).toBe('4.2');

    const el = document.createElement('div');
    renderOwnerFunnelDeskView(el, deskMetrics(empty));
    expect(el.querySelector('[data-owner-desk-gsc-note="missing_credentials"]')?.textContent).toBe(
      GSC_MISSING_NOTE,
    );
    const nums = [...el.querySelectorAll('[data-owner-desk-gsc-tiles] .text-2xl')].map(
      (n) => n.textContent,
    );
    expect(nums).toEqual(['—', '—', '—', '—']);
  });

  it('parses metrics.gsc and shows numbers only when status is ok', () => {
    const parsed = parseOwnerFunnelGsc({
      status: 'ok',
      clicks: 9,
      impressions: 100,
      tapRate: '9.0%',
      avgPosition: 3.4,
      toolPages: [{ label: 'https://www.viralrefer.app/tools/qr', clicks: 4 }],
      topSearches: [{ label: 'viral refer', clicks: 3 }],
      otherPages: [{ label: 'https://www.viralrefer.app/', clicks: 5 }],
      countries: [{ label: 'usa', clicks: 8 }],
    });
    expect(parsed.status).toBe('ok');
    expect(parsed.clicks).toBe(9);
    expect(parsed.impressions).toBe(100);
    expect(parsed.toolPages[0]?.label).toContain('/tools/qr');

    const el = document.createElement('div');
    renderOwnerFunnelDeskView(el, deskMetrics(parsed));
    expect(el.querySelector('[data-gsc-status]')?.getAttribute('data-gsc-status')).toBe('ok');
    expect(el.querySelector('[data-owner-desk-gsc-note]')).toBeNull();
    expect(el.querySelector('[data-owner-desk-gsc-list="tools"]')?.textContent).toMatch(/\/tools\/qr/);
    expect(el.querySelector('[data-owner-desk-gsc-list="searches"]')?.textContent).toMatch(
      /viral refer/,
    );
    expect(el.querySelector('[data-owner-desk-gsc-list="pages"]')?.textContent).toMatch(
      /viralrefer\.app/,
    );
    expect(el.querySelector('[data-owner-desk-gsc-list="countries"]')?.textContent).toMatch(/usa/);
  });

  it('returns missing_credentials from the handler when no server secret is set', async () => {
    const gsc = await resolveOwnerFunnelGsc({ secret: '' });
    expect(gsc.status).toBe('missing_credentials');
    expect(gsc.note).toBe(GSC_MISSING_NOTE);
    expect(gsc.property).toBe('https://www.viralrefer.app/');
    expect(gsc.consoleUrl).toContain('search-console/performance');
    expect(gsc.consoleUrl).toContain(encodeURIComponent(GSC_PROPERTY));
  });

  it('reads Edge names GSC_SERVICE_ACCOUNT_JSON then GSC_SITE_URL, never VITE_', () => {
    expect(GSC_EDGE_SECRET_NAMES).toEqual(['GSC_SERVICE_ACCOUNT_JSON', 'GSC_SITE_URL']);
    const gscSrc = readFileSync(resolve(root, 'supabase/functions/_shared/owner-funnel-gsc.ts'), 'utf8');
    expect(gscSrc).toContain("readEnv('GSC_SERVICE_ACCOUNT_JSON')");
    expect(gscSrc).toContain("readEnv('GSC_SITE_URL')");
    expect(gscSrc).not.toMatch(/GSC_API_KEY/);
    expect(gscSrc).not.toMatch(/VITE_GSC|VITE_GOOGLE|import\.meta\.env/);
    expect(gscSrc).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(gscSrc).not.toMatch(/console\.(log|info|debug|error|warn)\([^)]*(secret|json|GSC_SERVICE)/i);

    const saved = globalThis.Deno;
    const env: Record<string, string> = {};
    (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno = {
      env: { get: (k) => env[k] },
    };
    expect(readGscServerSecret()).toBe('');
    expect(readGscSiteUrl()).toBe(GSC_PROPERTY);
    env.VITE_GSC_API_KEY = 'must-never-be-read';
    expect(readGscServerSecret()).toBe('');
    env.GSC_SERVICE_ACCOUNT_JSON = '{"client_email":"x","private_key":"y"}';
    expect(readGscServerSecret()).toBe('{"client_email":"x","private_key":"y"}');
    env.GSC_SITE_URL = 'https://www.viralrefer.app/';
    expect(readGscSiteUrl()).toBe('https://www.viralrefer.app/');
    if (saved === undefined) delete (globalThis as { Deno?: unknown }).Deno;
    else (globalThis as { Deno?: unknown }).Deno = saved;
  });

  it('uses GSC_SITE_URL as the Search Console property and still requires the JSON secret', async () => {
    const saved = globalThis.Deno;
    const env: Record<string, string> = {
      GSC_SITE_URL: 'https://www.viralrefer.app/',
    };
    (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno = {
      env: { get: (k) => env[k] },
    };
    expect(readGscSiteUrl()).toBe('https://www.viralrefer.app/');
    const missing = await resolveOwnerFunnelGsc();
    expect(missing.status).toBe('missing_credentials');
    expect(missing.property).toBe('https://www.viralrefer.app/');

    env.GSC_SERVICE_ACCOUNT_JSON = '{"client_email":"x","private_key":"y"}';
    let queriedSite = '';
    const gsc = await resolveOwnerFunnelGsc({
      secret: 'ya29.test-token',
      query: async (token) => {
        queriedSite = String(token.site || '');
        return [{ clicks: 1, impressions: 10, position: 2 }];
      },
    });
    expect(queriedSite).toBe('https://www.viralrefer.app/');
    expect(gsc.status).toBe('ok');
    expect(gsc.property).toBe('https://www.viralrefer.app/');
    expect(gsc.consoleUrl).toContain(encodeURIComponent('https://www.viralrefer.app/'));
    if (saved === undefined) delete (globalThis as { Deno?: unknown }).Deno;
    else (globalThis as { Deno?: unknown }).Deno = saved;
  });

  it('maps Search Console rows when a query succeeds', async () => {
    const gsc = await resolveOwnerFunnelGsc({
      secret: 'ya29.test-token',
      query: async (_token, dimensions) => {
        if (dimensions.length === 0) {
          return [{ clicks: 10, impressions: 200, position: 5.5, ctr: 0.05 }];
        }
        if (dimensions[0] === 'page') {
          return [
            { keys: ['https://www.viralrefer.app/tools/share'], clicks: 6, impressions: 40, position: 2 },
            { keys: ['https://www.viralrefer.app/'], clicks: 4, impressions: 160, position: 8 },
          ];
        }
        if (dimensions[0] === 'query') {
          return [{ keys: ['referral contest'], clicks: 2, impressions: 20, position: 3 }];
        }
        return [{ keys: ['usa'], clicks: 7, impressions: 90, position: 4 }];
      },
    });
    expect(gsc.status).toBe('ok');
    expect(gsc.clicks).toBe(10);
    expect(gsc.impressions).toBe(200);
    expect(gsc.tapRate).toBe('5.0%');
    expect(gsc.avgPosition).toBe(5.5);
    expect(gsc.toolPages.map((r) => r.label)).toEqual(['https://www.viralrefer.app/tools/share']);
    expect(gsc.otherPages.map((r) => r.label)).toEqual(['https://www.viralrefer.app/']);
    expect(gsc.topSearches[0]?.label).toBe('referral contest');
    expect(gsc.countries[0]?.label).toBe('usa');
  });

  it('returns error status without inventing numbers when the API fails', async () => {
    const gsc = await resolveOwnerFunnelGsc({
      secret: 'ya29.bad',
      query: async () => {
        throw new Error('gsc 403');
      },
    });
    expect(gsc.status).toBe('error');
    expect(gsc.clicks).toBe(0);
    expect(gsc.note).toMatch(/could not load/i);
  });

  it('wires get_owner_funnel_desk to attach metrics.gsc', () => {
    const src = readFileSync(resolve(root, 'supabase/functions/admin-action/index.ts'), 'utf8');
    expect(src).toMatch(/action === 'get_owner_funnel_desk'/);
    expect(src).toMatch(/resolveOwnerFunnelGsc/);
    expect(src).toContain("Deno.env.get('GSC_SERVICE_ACCOUNT_JSON')");
    expect(src).toContain("Deno.env.get('GSC_SITE_URL')");
    expect(src).toMatch(/resolveOwnerFunnelGscTimed\(\{ secret, site \}\)/);
    expect(src).toMatch(/withTimeout/);
    expect(src).toMatch(/rpcData: null/);
    expect(src).toMatch(/get_public_funnel_ticker/);
    expect(src).toMatch(/get_public_get_link_stats/);
    expect(src).toMatch(/deskFromPublicSurfaces/);
    expect(src).toMatch(/timedLast\('visitor_events'/);
    expect(src).toMatch(/loadCompleteWindow: loadedWindow/);
    expect(src).not.toMatch(/loadCompleteWindow: async \(\) => emptyFeed/);
    expect(src).not.toMatch(/get_owner_funnel_desk_counts/);
    expect(src).not.toMatch(/console\.(log|info|debug|error|warn)\([^)]*secret/i);
    expect(src).toMatch(/data: \{ \.\.\.metrics, gsc \}/);
    expect(src).not.toMatch(/vercel --prod/);
    expect(src).not.toMatch(/GSC_API_KEY/);
    const deskUi = readFileSync(resolve(root, 'src/admin/owner-funnel-desk.ts'), 'utf8');
    expect(deskUi).toMatch(/timeoutMs:\s*8_000/);
    const client = readFileSync(resolve(root, 'src/lib/admin-action-client.ts'), 'utf8');
    expect(client).toMatch(/if \(options\?\.timeoutMs\) return viaFetch/);
  });

  it('times out a slow GSC resolve and returns timeout or last-ok cache', async () => {
    resetGscOkCache();
    const hang = () => new Promise<never>(() => {});
    const timed = await resolveOwnerFunnelGscTimed({
      secret: 'ya29.test-token',
      timeoutMs: 20,
      query: hang,
    });
    expect(timed.status).toBe('timeout');
    expect(timed.note).toBe(GSC_TIMEOUT_NOTE);
    expect(timed.clicks).toBe(0);

    rememberOkGsc(
      parseOwnerFunnelGsc({
        status: 'ok',
        clicks: 7,
        impressions: 70,
        tapRate: '10.0%',
      }),
    );
    const cached = await resolveOwnerFunnelGscTimed({
      secret: 'ya29.test-token',
      timeoutMs: 20,
      query: hang,
    });
    expect(cached.status).toBe('ok-cached');
    expect(cached.clicks).toBe(7);
    expect(cached.note).toBe(GSC_CACHED_NOTE);
    resetGscOkCache();
  });

  it('withTimeout returns the fallback when the promise is slow', async () => {
    const value = await withTimeout(
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('late'), 200);
      }),
      20,
      () => 'fallback',
    );
    expect(value).toBe('fallback');
  });

  it('parses timeout and ok-cached statuses for the desk card', () => {
    expect(parseOwnerFunnelGsc({ status: 'timeout' }).status).toBe('timeout');
    expect(parseOwnerFunnelGsc({ status: 'timeout' }).note).toBe(GSC_TIMEOUT_NOTE);
    expect(parseOwnerFunnelGsc({ status: 'ok-cached', clicks: 3 }).status).toBe('ok-cached');
    const el = document.createElement('div');
    renderOwnerFunnelDeskView(
      el,
      deskMetrics(parseOwnerFunnelGsc({ status: 'timeout', note: GSC_TIMEOUT_NOTE })),
    );
    expect(el.querySelector('[data-gsc-status]')?.getAttribute('data-gsc-status')).toBe('timeout');
    expect(el.textContent).toContain(GSC_TIMEOUT_NOTE);
  });

  it('does not edit the GSC verification file', () => {
    const html = readFileSync(resolve(root, 'public/google163d31ba24216edd.html'), 'utf8');
    expect(html).toContain('google-site-verification: google163d31ba24216edd.html');
    const gscSrc = readFileSync(resolve(root, 'supabase/functions/_shared/owner-funnel-gsc.ts'), 'utf8');
    expect(gscSrc).not.toMatch(/google163d31ba24216edd/);
  });
});
