/** Hourly/daily rollups. Pageviews buffer in-isolate. Joins/credits flush immediately. */

export type TrackKind =
  | 'pageview'
  | 'land'
  | 'paste'
  | 'join'
  | 'share'
  | 'friend_land'
  | 'credit'
  | 'blocked'
  | 'self_ref'
  | 'burst_ip'
  | 'embed_load'
  | 'embed_click'
  | 'error';

export type Platform = 'x' | 'whatsapp' | 'telegram' | 'reddit' | 'qr' | 'embed' | 'direct' | 'native' | 'copy' | 'other';

export interface HourBucket {
  hour: string;
  pageviews: number;
  uniques: number;
  sessions: number;
  lands: number;
  pastes: number;
  joins: number;
  shares: number;
  friendLands: number;
  credits: number;
  blockedCredits: number;
  selfRef: number;
  burstIp: number;
  embedLoads: number;
  embedClicks: number;
  errors: number;
  platforms: Record<string, number>;
  referrers: Record<string, number>;
  utm: Record<string, number>;
  geo: Record<string, number>;
  device: Record<string, number>;
  browser: Record<string, number>;
}

export interface AdminEvent {
  id: string;
  at: number;
  kind: TrackKind;
  text: string;
  platform?: string;
  country?: string;
}

export interface RungMark {
  at: number;
  host: string;
  rung: string;
}

export interface VisitorHints {
  country: string;
  device: 'mobile' | 'desktop';
  browser: string;
  referrer: string;
  utm: string;
  platform?: Platform;
}

const COUNTERS: (keyof HourBucket)[] = [
  'pageviews',
  'uniques',
  'sessions',
  'lands',
  'pastes',
  'joins',
  'shares',
  'friendLands',
  'credits',
  'blockedCredits',
  'selfRef',
  'burstIp',
  'embedLoads',
  'embedClicks',
  'errors',
];

const MAPS = ['platforms', 'referrers', 'utm', 'geo', 'device', 'browser'] as const;

export function hourId(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 13);
}

export function dayId(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function emptyBucket(hour: string): HourBucket {
  return {
    hour,
    pageviews: 0,
    uniques: 0,
    sessions: 0,
    lands: 0,
    pastes: 0,
    joins: 0,
    shares: 0,
    friendLands: 0,
    credits: 0,
    blockedCredits: 0,
    selfRef: 0,
    burstIp: 0,
    embedLoads: 0,
    embedClicks: 0,
    errors: 0,
    platforms: {},
    referrers: {},
    utm: {},
    geo: {},
    device: {},
    browser: {},
  };
}

export function mergeBuckets(...parts: HourBucket[]): HourBucket {
  const out = emptyBucket(parts[0]?.hour || hourId());
  for (const b of parts) {
    for (const k of COUNTERS) out[k] = (out[k] as number) + (b[k] as number);
    for (const map of MAPS) {
      for (const [key, n] of Object.entries(b[map] || {})) {
        out[map][key] = (out[map][key] || 0) + n;
      }
    }
  }
  return out;
}

export function addCount(map: Record<string, number>, key: string, n = 1): void {
  const k = (key || 'direct').slice(0, 48);
  map[k] = (map[k] || 0) + n;
}

export function hintsFromRequest(request: Request, body: { platform?: string; utm?: string; referrer?: string } = {}): VisitorHints {
  const country = (request.headers.get('cf-ipcountry') || 'XX').toUpperCase();
  const ua = request.headers.get('user-agent') || '';
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
  let browser = 'other';
  if (/Edg\//i.test(ua)) browser = 'edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'safari';
  else if (/Firefox\//i.test(ua)) browser = 'firefox';
  const refHeader = request.headers.get('referer') || body.referrer || '';
  let referrer = 'direct';
  try {
    if (refHeader) referrer = new URL(refHeader).hostname.replace(/^www\./, '') || 'direct';
  } catch {
    referrer = 'direct';
  }
  const platform = normalizePlatform(body.platform);
  return { country, device, browser, referrer, utm: (body.utm || 'none').slice(0, 32), platform };
}

export function normalizePlatform(raw?: string): Platform | undefined {
  const v = String(raw || '').toLowerCase();
  if (['x', 'whatsapp', 'telegram', 'reddit', 'qr', 'embed', 'direct', 'native', 'copy', 'other'].includes(v)) {
    return v as Platform;
  }
  return undefined;
}

export function applyEvent(bucket: HourBucket, kind: TrackKind, hints: VisitorHints): void {
  addCount(bucket.geo, hints.country);
  addCount(bucket.device, hints.device);
  addCount(bucket.browser, hints.browser);
  addCount(bucket.referrers, hints.referrer);
  addCount(bucket.utm, hints.utm);
  if (hints.platform) addCount(bucket.platforms, hints.platform);

  switch (kind) {
    case 'pageview':
      bucket.pageviews += 1;
      break;
    case 'land':
      bucket.lands += 1;
      bucket.pageviews += 1;
      break;
    case 'paste':
      bucket.pastes += 1;
      break;
    case 'join':
      bucket.joins += 1;
      break;
    case 'share':
      bucket.shares += 1;
      break;
    case 'friend_land':
      bucket.friendLands += 1;
      break;
    case 'credit':
      bucket.credits += 1;
      break;
    case 'blocked':
      bucket.blockedCredits += 1;
      break;
    case 'self_ref':
      bucket.selfRef += 1;
      break;
    case 'burst_ip':
      bucket.burstIp += 1;
      break;
    case 'embed_load':
      bucket.embedLoads += 1;
      break;
    case 'embed_click':
      bucket.embedClicks += 1;
      break;
    case 'error':
      bucket.errors += 1;
      break;
  }
}

export function funnelRates(b: HourBucket) {
  const pct = (a: number, c: number) => (c > 0 ? Math.round((a / c) * 1000) / 10 : 0);
  return {
    landToPaste: pct(b.pastes, b.lands || b.pageviews),
    pasteToJoin: pct(b.joins, b.pastes),
    joinToShare: pct(b.shares, b.joins),
    shareToFriend: pct(b.friendLands, b.shares),
    friendToCredit: pct(b.credits, b.friendLands),
    shareToCredit: pct(b.credits, b.shares),
    bounce: pct(Math.max(0, (b.lands || b.pageviews) - b.joins), b.lands || b.pageviews),
  };
}

export function topMap(map: Record<string, number>, n = 8): { key: string; n: number }[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, c]) => ({ key, n: c }));
}

export function daysBack(range: string, now = Date.now()): string[] {
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(dayId(now - i * 86_400_000));
  }
  return out;
}

export function eventText(kind: TrackKind, extra = ''): string {
  const labels: Record<TrackKind, string> = {
    pageview: 'Pageview',
    land: 'Landed on Ultra',
    paste: 'Pasted a site',
    join: 'Got a link',
    share: 'Share click',
    friend_land: 'Friend opened a share link',
    credit: 'Unique friend credit',
    blocked: 'Blocked credit',
    self_ref: 'Self-ref ignored',
    burst_ip: 'Burst IP flagged',
    embed_load: 'Embed loaded',
    embed_click: 'Embed click',
    error: 'Error',
  };
  return extra ? `${labels[kind]} · ${extra}` : labels[kind];
}
