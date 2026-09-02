/**
 * Owner desk Google Search Console tracker.
 * Verification HTML is separate — this only reads performance numbers.
 */

export const GSC_PROPERTY = 'https://www.viralrefer.app/';
export function gscConsoleUrlFor(property: string): string {
  return (
    'https://search.google.com/search-console/performance/search-analytics?resource_id=' +
    encodeURIComponent(property)
  );
}
export const GSC_CONSOLE_URL = gscConsoleUrlFor(GSC_PROPERTY);
export const GSC_WINDOW_DAYS = 28;
export const GSC_MISSING_NOTE =
  'Search Console is verified. Add the API key on the server to show numbers here.';

export type OwnerFunnelGscStatus = 'ok' | 'missing_credentials' | 'error';

export type OwnerFunnelGscRow = {
  label: string;
  clicks: number;
  impressions: number;
  position: number | null;
};

export type OwnerFunnelGscMetrics = {
  status: OwnerFunnelGscStatus;
  windowDays: number;
  clicks: number;
  impressions: number;
  tapRate: string;
  avgPosition: number | null;
  toolPages: OwnerFunnelGscRow[];
  topSearches: OwnerFunnelGscRow[];
  otherPages: OwnerFunnelGscRow[];
  countries: OwnerFunnelGscRow[];
  note?: string;
  property: string;
  consoleUrl: string;
};

const EMPTY_ROWS: OwnerFunnelGscRow[] = [];

export function emptyOwnerFunnelGsc(
  status: OwnerFunnelGscStatus = 'missing_credentials',
  note?: string,
): OwnerFunnelGscMetrics {
  const property = readGscSiteUrl();
  return {
    status,
    windowDays: GSC_WINDOW_DAYS,
    clicks: 0,
    impressions: 0,
    tapRate: '—',
    avgPosition: null,
    toolPages: EMPTY_ROWS,
    topSearches: EMPTY_ROWS,
    otherPages: EMPTY_ROWS,
    countries: EMPTY_ROWS,
    note: note ?? (status === 'missing_credentials' ? GSC_MISSING_NOTE : undefined),
    property,
    consoleUrl: gscConsoleUrlFor(property),
  };
}

function num(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return 0;
}

function optPos(raw: unknown): number | null {
  const n = num(raw);
  return n > 0 ? n : raw == null || raw === '' ? null : n;
}

function parseRows(raw: unknown): OwnerFunnelGscRow[] {
  if (!Array.isArray(raw)) return [];
  const out: OwnerFunnelGscRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const keys = Array.isArray(o.keys) ? o.keys : [];
    const label = String(o.label || keys[0] || o.query || o.page || o.country || '').trim();
    if (!label) continue;
    out.push({
      label,
      clicks: num(o.clicks),
      impressions: num(o.impressions),
      position: optPos(o.position ?? o.avgPosition),
    });
  }
  return out;
}

export function parseOwnerFunnelGsc(raw: unknown): OwnerFunnelGscMetrics {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyOwnerFunnelGsc();
  }
  const o = raw as Record<string, unknown>;
  const statusRaw = String(o.status || '').trim().toLowerCase();
  const status: OwnerFunnelGscStatus =
    statusRaw === 'ok' || statusRaw === 'error' || statusRaw === 'missing_credentials'
      ? statusRaw
      : 'missing_credentials';
  const clicks = num(o.clicks);
  const impressions = num(o.impressions);
  const tapRate =
    typeof o.tapRate === 'string' && o.tapRate.trim()
      ? o.tapRate.trim()
      : impressions > 0
        ? `${((clicks / impressions) * 100).toFixed(1)}%`
        : '—';
  const note =
    typeof o.note === 'string' && o.note.trim()
      ? o.note.trim()
      : status === 'missing_credentials'
        ? GSC_MISSING_NOTE
        : undefined;
  return {
    status,
    windowDays: num(o.windowDays ?? o.window_days) || GSC_WINDOW_DAYS,
    clicks,
    impressions,
    tapRate,
    avgPosition: optPos(o.avgPosition ?? o.position),
    toolPages: parseRows(o.toolPages ?? o.tool_pages),
    topSearches: parseRows(o.topSearches ?? o.top_searches),
    otherPages: parseRows(o.otherPages ?? o.other_pages),
    countries: parseRows(o.countries ?? o.search_countries),
    note,
    property: String(o.property || GSC_PROPERTY),
    consoleUrl: String(o.consoleUrl || o.console_url || GSC_CONSOLE_URL),
  };
}

export function formatGscPosition(pos: number | null): string {
  if (pos == null || !Number.isFinite(pos) || pos <= 0) return '—';
  return pos.toFixed(1);
}

export function formatGscCount(n: number, status: OwnerFunnelGscStatus): string {
  if (status !== 'ok') return '—';
  return String(Math.round(n));
}

type GscQueryRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

async function gscQuery(
  token: { bearer?: string; apiKey?: string; site?: string },
  dimensions: string[],
  rowLimit = 15,
): Promise<GscQueryRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - GSC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const site = encodeURIComponent(token.site || GSC_PROPERTY);
  const qs = token.apiKey && !token.bearer ? `?key=${encodeURIComponent(token.apiKey)}` : '';
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query${qs}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token.bearer) headers.Authorization = `Bearer ${token.bearer}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      startDate: iso(start),
      endDate: iso(end),
      dimensions,
      rowLimit,
    }),
  });
  if (!res.ok) {
    throw new Error(`gsc ${res.status}`);
  }
  const body = (await res.json()) as { rows?: GscQueryRow[] };
  return Array.isArray(body.rows) ? body.rows : [];
}

function rowsFromQuery(rows: GscQueryRow[]): OwnerFunnelGscRow[] {
  return rows.map((row) => ({
    label: String(row.keys?.[0] || '').trim(),
    clicks: num(row.clicks),
    impressions: num(row.impressions),
    position: optPos(row.position),
  })).filter((row) => row.label);
}

function isToolPage(url: string): boolean {
  return /\/tools(\/|$)/i.test(url);
}

/** Supabase Edge secret names. Never VITE_ — the browser must not see these. */
export const GSC_EDGE_SECRET_NAMES = ['GSC_SERVICE_ACCOUNT_JSON', 'GSC_SITE_URL'] as const;

function readEnv(name: string): string {
  if (!name || name.startsWith('VITE_')) return '';
  try {
    const deno = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
    const env = deno?.env;
    if (env && typeof env.get === 'function') {
      const fromDeno = String(env.get(name) || '').trim();
      if (fromDeno) return fromDeno;
    }
  } catch {
    /* Deno missing in unit tests */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return String(proc?.env?.[name] || '').trim();
  } catch {
    return '';
  }
}

export function readGscServerSecret(): string {
  return readEnv('GSC_SERVICE_ACCOUNT_JSON');
}

export function readGscSiteUrl(): string {
  return readEnv('GSC_SITE_URL') || GSC_PROPERTY;
}

function isServiceAccountJson(raw: string): boolean {
  return raw.startsWith('{') && raw.includes('private_key') && raw.includes('client_email');
}

async function accessTokenFromServiceAccount(jsonText: string): Promise<string> {
  const parsed = JSON.parse(jsonText) as { client_email?: string; private_key?: string };
  const email = String(parsed.client_email || '').trim();
  const pem = String(parsed.private_key || '').replace(/\\n/g, '\n');
  if (!email || !pem) throw new Error('service account incomplete');

  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const claim = btoa(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const data = `${header}.${claim}`;
  const key = await importPkcs8(pem);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  const assertion = `${data}.${bufToB64Url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) throw new Error('gsc token');
  return body.access_token;
}

function bufToB64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function resolveOwnerFunnelGsc(opts?: {
  secret?: string;
  query?: typeof gscQuery;
}): Promise<OwnerFunnelGscMetrics> {
  const secret = (opts?.secret ?? readGscServerSecret()).trim();
  if (!secret) return emptyOwnerFunnelGsc('missing_credentials');

  const query = opts?.query ?? gscQuery;
  try {
    let bearer = '';
    let apiKey = '';
    if (isServiceAccountJson(secret)) {
      bearer = await accessTokenFromServiceAccount(secret);
    } else if (secret.startsWith('AIza')) {
      apiKey = secret;
    } else {
      bearer = secret;
    }
    const site = readGscSiteUrl();
    const token = { bearer: bearer || undefined, apiKey: apiKey || undefined, site };
    const [totals, pages, queries, countries] = await Promise.all([
      query(token, [], 1),
      query(token, ['page'], 20),
      query(token, ['query'], 8),
      query(token, ['country'], 8),
    ]);
    const total = totals[0] || { clicks: 0, impressions: 0, position: 0, ctr: 0 };
    const pageRows = rowsFromQuery(pages);
    const toolPages = pageRows.filter((row) => isToolPage(row.label));
    const otherPages = pageRows.filter((row) => !isToolPage(row.label));
    const clicks = num(total.clicks);
    const impressions = num(total.impressions);
    return {
      status: 'ok',
      windowDays: GSC_WINDOW_DAYS,
      clicks,
      impressions,
      tapRate: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : '0.0%',
      avgPosition: optPos(total.position),
      toolPages,
      topSearches: rowsFromQuery(queries),
      otherPages,
      countries: rowsFromQuery(countries),
      property: site,
      consoleUrl: gscConsoleUrlFor(site),
    };
  } catch {
    return emptyOwnerFunnelGsc('error', 'Search Console numbers could not load.');
  }
}
