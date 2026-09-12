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

export function teDestination(
  origin: string,
  opts: { ref?: string | null; camp?: string | null; extra?: Record<string, string> } = {},
): string {
  const u = new URL('/te', origin.endsWith('/') ? origin : `${origin}/`);
  u.searchParams.set('src', 'te');
  if (opts.camp) u.searchParams.set('camp', opts.camp);
  if (opts.ref) u.searchParams.set('ref', opts.ref);
  for (const [k, v] of Object.entries(opts.extra || {})) {
    if (v) u.searchParams.set(k, v);
  }
  return u.toString();
}

export function breakoutUrl(origin: string, camp: Campaign, ref?: string | null): string {
  const u = new URL('/', origin.endsWith('/') ? origin : `${origin}/`);
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
