/**
 * Platform guard — watch Nano load, disk, Edge runs, and live sockets.
 * Cuts click/scroll noise and idle live sockets. Never blocks Get-link, Send, or credit.
 */

export const PLATFORM_DISK_LIMIT_BYTES = 500 * 1024 * 1024;
export const PLATFORM_EDGE_LIMIT_MONTH = 500_000;
export const PLATFORM_ACTIVITY_WATCH = 30;
export const PLATFORM_ACTIVITY_HOLE = 45;
export const PLATFORM_DISK_WATCH = 0.55;
export const PLATFORM_DISK_HOLE = 0.8;
export const PLATFORM_EDGE_WATCH = 0.55;
export const PLATFORM_EDGE_HOLE = 0.85;

export type PlatformGuardStatus = 'ok' | 'watch' | 'hole';

export type PlatformGuardSnapshot = {
  diskBytes: number;
  diskLimitBytes: number;
  visitorEventRows: number;
  interactionEventRows: number;
  edgeInvokesMonth: number;
  edgeLimit: number;
  dbActivity: number;
  dropNoise: boolean;
  skipRealtime: boolean;
  prunedInteractions?: number;
  updatedAt?: string;
};

export type PlatformGuardMeter = {
  id: 'compute' | 'disk' | 'edge' | 'live';
  label: string;
  value: string;
  note: string;
  status: PlatformGuardStatus;
};

export type PlatformGuardView = {
  meters: PlatformGuardMeter[];
  dropNoise: boolean;
  skipRealtime: boolean;
  title: string;
  detail: string;
  severity: PlatformGuardStatus;
};

const BANNED =
  /Funnel|Friends|Prize|Website|Promoters|Referrals|Banners|Claims|\bCMS\b|What.?s happening now|More numbers/i;

function num(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(999, (part / whole) * 100);
}

function statusFromPct(p: number, watch: number, hole: number): PlatformGuardStatus {
  if (p >= hole * 100) return 'hole';
  if (p >= watch * 100) return 'watch';
  return 'ok';
}

export function emptyPlatformGuardSnapshot(): PlatformGuardSnapshot {
  return {
    diskBytes: 0,
    diskLimitBytes: PLATFORM_DISK_LIMIT_BYTES,
    visitorEventRows: 0,
    interactionEventRows: 0,
    edgeInvokesMonth: 0,
    edgeLimit: PLATFORM_EDGE_LIMIT_MONTH,
    dbActivity: 0,
    dropNoise: false,
    skipRealtime: false,
  };
}

export function parsePlatformGuardSnapshot(raw: unknown): PlatformGuardSnapshot {
  const empty = emptyPlatformGuardSnapshot();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
  const row = raw as Record<string, unknown>;
  const diskLimit = num(row.diskLimitBytes ?? row.disk_limit_bytes) || PLATFORM_DISK_LIMIT_BYTES;
  const edgeLimit = num(row.edgeLimit ?? row.edge_limit) || PLATFORM_EDGE_LIMIT_MONTH;
  return {
    diskBytes: num(row.diskBytes ?? row.disk_bytes),
    diskLimitBytes: diskLimit,
    visitorEventRows: Math.floor(num(row.visitorEventRows ?? row.visitor_event_rows)),
    interactionEventRows: Math.floor(num(row.interactionEventRows ?? row.interaction_event_rows)),
    edgeInvokesMonth: Math.floor(num(row.edgeInvokesMonth ?? row.edge_invokes_month)),
    edgeLimit,
    dbActivity: Math.floor(num(row.dbActivity ?? row.db_activity)),
    dropNoise: row.dropNoise === true || row.drop_noise === true,
    skipRealtime: row.skipRealtime === true || row.skip_realtime === true,
    prunedInteractions: Math.floor(num(row.prunedInteractions ?? row.pruned_interactions)),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

export function evaluatePlatformGuard(raw: unknown): PlatformGuardView {
  const snap = parsePlatformGuardSnapshot(raw);
  const diskPct = pct(snap.diskBytes, snap.diskLimitBytes);
  const edgePct = pct(snap.edgeInvokesMonth, snap.edgeLimit);
  const diskStatus = statusFromPct(diskPct, PLATFORM_DISK_WATCH, PLATFORM_DISK_HOLE);
  const edgeStatus = statusFromPct(edgePct, PLATFORM_EDGE_WATCH, PLATFORM_EDGE_HOLE);
  const computeStatus =
    snap.dbActivity >= PLATFORM_ACTIVITY_HOLE
      ? 'hole'
      : snap.dbActivity >= PLATFORM_ACTIVITY_WATCH
        ? 'watch'
        : 'ok';
  const skipRealtime =
    snap.skipRealtime ||
    computeStatus !== 'ok' ||
    diskStatus === 'hole';
  const dropNoise =
    snap.dropNoise ||
    diskStatus !== 'ok' ||
    edgeStatus !== 'ok' ||
    computeStatus === 'hole';
  const liveStatus: PlatformGuardStatus = skipRealtime ? (computeStatus === 'hole' ? 'hole' : 'watch') : 'ok';

  const meters: PlatformGuardMeter[] = [
    {
      id: 'compute',
      label: 'Load',
      value: String(snap.dbActivity),
      note: 'Open database sessions',
      status: computeStatus,
    },
    {
      id: 'disk',
      label: 'Disk',
      value: `${diskPct.toFixed(1)}%`,
      note: `${snap.visitorEventRows} land rows · ${snap.interactionEventRows} click rows`,
      status: diskStatus,
    },
    {
      id: 'edge',
      label: 'Edge',
      value: `${edgePct.toFixed(1)}%`,
      note: `${snap.edgeInvokesMonth} runs this month`,
      status: edgeStatus,
    },
    {
      id: 'live',
      label: 'Live',
      value: skipRealtime ? 'poll' : 'on',
      note: skipRealtime ? 'Sockets off · board still polls' : 'One socket while the tab is shown',
      status: liveStatus,
    },
  ];

  let title = 'Headroom is fine.';
  let detail = 'Click/scroll noise stays on. Get-link, Send, and credit stay on.';
  let severity: PlatformGuardStatus = 'ok';
  if (diskStatus === 'hole') {
    title = 'Disk is near the freeze line.';
    detail = 'Clear junk visits. Old click rows prune on the daily job. Credits stay.';
    severity = 'hole';
  } else if (computeStatus === 'hole') {
    title = 'The small computer is busy.';
    detail = 'Click/scroll writes pause. Live sockets pause. Get-link still runs.';
    severity = 'hole';
  } else if (edgeStatus === 'hole') {
    title = 'Edge runs are near the monthly cap.';
    detail = 'Click/scroll writes pause. Get-link, Send, and credit stay.';
    severity = 'hole';
  } else if (dropNoise) {
    title = 'Noise writes are paused.';
    detail = 'Click/scroll stays local. Get-link, Send, and credit stay on the server.';
    severity = 'watch';
  } else if (skipRealtime) {
    title = 'Live sockets are paused.';
    detail = 'The board still refreshes on a timer while this tab is shown.';
    severity = 'watch';
  }

  return { meters, dropNoise, skipRealtime, title, detail, severity };
}

export function platformGuardCopyIsDeskSafe(view: PlatformGuardView): boolean {
  const blob = `${view.title} ${view.detail} ${view.meters.map((m) => `${m.label} ${m.note}`).join(' ')}`;
  return !BANNED.test(blob);
}

let cached: PlatformGuardSnapshot | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export function rememberPublicPlatformGuard(snap: PlatformGuardSnapshot): void {
  cached = snap;
  cachedAt = Date.now();
  try {
    sessionStorage.setItem('vr_platform_guard', JSON.stringify({ snap, at: cachedAt }));
  } catch {
    /* ignore */
  }
}

export function readCachedPublicPlatformGuard(): PlatformGuardSnapshot | null {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  try {
    const raw = sessionStorage.getItem('vr_platform_guard');
    if (!raw) return cached;
    const parsed = JSON.parse(raw) as { snap?: unknown; at?: number };
    if (parsed && typeof parsed.at === 'number' && Date.now() - parsed.at < CACHE_MS) {
      cached = parsePlatformGuardSnapshot(parsed.snap);
      cachedAt = parsed.at;
      return cached;
    }
  } catch {
    /* ignore */
  }
  return cached;
}

export function shouldDropNoiseWrites(): boolean {
  const snap = readCachedPublicPlatformGuard();
  if (!snap) return false;
  return evaluatePlatformGuard(snap).dropNoise;
}

export function shouldSkipRealtimeSockets(): boolean {
  if (typeof document !== 'undefined' && document.hidden) return true;
  const snap = readCachedPublicPlatformGuard();
  if (!snap) return false;
  return evaluatePlatformGuard(snap).skipRealtime;
}
