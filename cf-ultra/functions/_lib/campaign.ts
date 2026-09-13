export type Campaign = {
  src: string;
  camp: string;
  te: boolean;
};

const TE_SOURCES = new Set([
  'te',
  'te-rotator',
  'rotator',
  'hitexchange',
  'hit-exchange',
  'hit_exchange',
  'traffic_exchange',
  'traffic-exchange',
  'hx',
]);

export function isTeSource(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return TE_SOURCES.has(v) || v.startsWith('te_') || v.startsWith('te-');
}

export function parseCampaign(input: {
  src?: string | null;
  camp?: string | null;
  c?: string | null;
  utm?: string | null;
  utm_source?: string | null;
} = {}): Campaign {
  const srcRaw = String(input.src || input.utm_source || input.utm || '')
    .trim()
    .toLowerCase()
    .slice(0, 32);
  const camp = String(input.camp || input.c || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40);
  const te = isTeSource(srcRaw);
  return { src: te ? 'te' : srcRaw, camp, te };
}

export function campaignFromSearch(search: string | URLSearchParams): Campaign {
  const q = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`) : search;
  return parseCampaign({
    src: q.get('src'),
    camp: q.get('camp'),
    c: q.get('c'),
    utm: q.get('utm_source') || q.get('utm'),
    utm_source: q.get('utm_source'),
  });
}

/** Survive cookie blocks: keep campaign + UTM tags on the next URL. */
export const PASS_THROUGH_KEYS = [
  'size',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm',
  'lang',
  'locale',
] as const;

export function passThroughTags(search: URLSearchParams | Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!search) return out;
  const get = (key: string) =>
    search instanceof URLSearchParams ? search.get(key) : search[key];
  for (const key of PASS_THROUGH_KEYS) {
    const v = String(get(key) || '')
      .trim()
      .slice(0, 80);
    if (v) out[key] = v;
  }
  return out;
}

export function applySearchTags(u: URL, extra?: Record<string, string> | URLSearchParams): void {
  const tags = extra instanceof URLSearchParams ? passThroughTags(extra) : extra || {};
  for (const [k, v] of Object.entries(tags)) {
    if (v) u.searchParams.set(k, v);
  }
}

export function taggedPath(
  origin: string,
  path: string,
  opts: { ref?: string | null; camp?: string | null; extra?: Record<string, string> | URLSearchParams } = {},
): string {
  const u = new URL(path, origin.endsWith('/') ? origin : `${origin}/`);
  u.searchParams.set('src', 'te');
  if (opts.camp) u.searchParams.set('camp', opts.camp);
  if (opts.ref) u.searchParams.set('ref', opts.ref);
  applySearchTags(u, opts.extra);
  return u.toString();
}

export function teDestination(
  origin: string,
  opts: { ref?: string | null; camp?: string | null; extra?: Record<string, string> | URLSearchParams } = {},
): string {
  return taggedPath(origin, '/te', opts);
}

export function splashDestination(
  origin: string,
  opts: { ref?: string | null; camp?: string | null; extra?: Record<string, string> | URLSearchParams } = {},
): string {
  return taggedPath(origin, '/splash', opts);
}

export function breakoutUrl(
  origin: string,
  camp: Campaign,
  ref?: string | null,
  extra?: Record<string, string> | URLSearchParams,
): string {
  const u = new URL('/', origin.endsWith('/') ? origin : `${origin}/`);
  applySearchTags(u, extra);
  if (camp.te || camp.src) u.searchParams.set('src', camp.te ? 'te' : camp.src);
  if (camp.camp) u.searchParams.set('camp', camp.camp);
  if (ref) u.searchParams.set('ref', ref);
  return u.toString();
}

export function teIframeSnippet(
  origin: string,
  opts: { ref?: string | null; camp?: string | null; width?: number; height?: number } = {},
): string {
  const w = opts.width || 468;
  const h = opts.height || 60;
  const dest = teDestination(origin, {
    ref: opts.ref,
    camp: opts.camp,
    extra: { size: `${w}x${h}` },
  });
  return `<iframe src="${dest}" width="${w}" height="${h}" style="border:0;overflow:hidden;max-width:100%" loading="lazy" title="ViralRefer Site Drops"></iframe>`;
}
