import { buildBoard, createEmptyState, emptyBoard, type BoardState, type UltraState } from './engine';

export interface UltraEnv {
  BOARD?: KVNamespace;
  ADMIN_OWNER_PASSWORD?: string;
  ADMIN_ACTION_SECRET?: string;
  /** Discord / Slack / generic HTTPS webhook. Pages secret — never VITE_. Overrides Admin-saved URL. */
  NOTIFY_WEBHOOK_URL?: string;
  /** Telegram Bot API token. Pages / wrangler secret — never VITE_ and never commit. */
  TELEGRAM_BOT_TOKEN?: string;
  /** Telegram chat id. Defaults to 1274269043 for this owner deploy. Never VITE_. */
  TELEGRAM_CHAT_ID?: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_EMAIL_FROM?: string;
}

export type BoardRead = {
  board: BoardState;
  stale: boolean;
  degraded: boolean;
  cache: 'isolate' | 'kv' | 'computed' | 'empty';
};

export type SaveResult = { persisted: boolean; degraded: boolean };

const MEMORY_KEY = '__VIRALREFER_ULTRA_STATE__';
const STATE_ISOLATE_MS = 1_500;
const BOARD_ISOLATE_MS = 2_500;

type MemoryBag = {
  state: UltraState;
  demoMode: true;
};

type StateCache = { state: UltraState; demoMode: boolean; at: number };
type BoardCache = { board: BoardState; at: number };

const g = globalThis as typeof globalThis & {
  [MEMORY_KEY]?: MemoryBag;
  __ULTRA_STATE_CACHE__?: StateCache;
  __ULTRA_BOARD_CACHE__?: BoardCache;
};

function memoryBag(): MemoryBag {
  if (!g[MEMORY_KEY]) {
    g[MEMORY_KEY] = { state: createEmptyState(), demoMode: true };
  }
  return g[MEMORY_KEY]!;
}

export function kvBound(env: UltraEnv): boolean {
  return Boolean(env.BOARD && typeof env.BOARD.get === 'function');
}

export function rememberState(state: UltraState, demoMode: boolean): void {
  g.__ULTRA_STATE_CACHE__ = { state, demoMode, at: Date.now() };
}

export function rememberBoard(board: BoardState): void {
  g.__ULTRA_BOARD_CACHE__ = { board, at: Date.now() };
}

function parseState(raw: unknown): UltraState {
  const parsed = raw as UltraState;
  return {
    players: parsed.players ?? {},
    sites: parsed.sites ?? {},
    actorToCode: parsed.actorToCode ?? {},
    credits: parsed.credits ?? {},
    activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    kingmakers: Array.isArray(parsed.kingmakers) ? parsed.kingmakers : [],
    bannerHost: parsed.bannerHost ?? null,
  };
}

export async function loadState(env: UltraEnv): Promise<{ state: UltraState; demoMode: boolean }> {
  const cached = g.__ULTRA_STATE_CACHE__;
  if (cached && Date.now() - cached.at < STATE_ISOLATE_MS) {
    return { state: cached.state, demoMode: cached.demoMode };
  }
  if (!kvBound(env)) {
    const bag = memoryBag();
    rememberState(bag.state, true);
    return { state: bag.state, demoMode: true };
  }
  try {
    const raw = await env.BOARD!.get('ultra:state', 'json');
    if (raw && typeof raw === 'object') {
      const state = parseState(raw);
      rememberState(state, false);
      return { state, demoMode: false };
    }
  } catch {
    if (cached) return { state: cached.state, demoMode: cached.demoMode };
  }
  const fresh = createEmptyState();
  rememberState(fresh, false);
  return { state: fresh, demoMode: false };
}

export async function getBoard(env: UltraEnv): Promise<BoardRead> {
  const now = Date.now();
  const iso = g.__ULTRA_BOARD_CACHE__;
  if (iso && now - iso.at < BOARD_ISOLATE_MS) {
    return { board: iso.board, stale: false, degraded: false, cache: 'isolate' };
  }

  if (kvBound(env)) {
    try {
      const snap = (await env.BOARD!.get('ultra:board', 'json')) as { board?: BoardState; at?: number } | null;
      if (snap?.board && typeof snap.board === 'object') {
        rememberBoard(snap.board);
        return {
          board: snap.board,
          stale: typeof snap.at === 'number' ? now - snap.at > 60_000 : false,
          degraded: false,
          cache: 'kv',
        };
      }
    } catch {
      if (iso) return { board: iso.board, stale: true, degraded: true, cache: 'isolate' };
    }
  }

  try {
    const { state, demoMode } = await loadState(env);
    const board = buildBoard(state, Date.now(), demoMode);
    rememberBoard(board);
    return { board, stale: false, degraded: false, cache: 'computed' };
  } catch {
    if (iso) return { board: iso.board, stale: true, degraded: true, cache: 'isolate' };
    return { board: emptyBoard(!kvBound(env)), stale: true, degraded: true, cache: 'empty' };
  }
}

export async function saveState(env: UltraEnv, state: UltraState, demoMode: boolean): Promise<SaveResult> {
  const board = buildBoard(state, Date.now(), demoMode);
  rememberState(state, demoMode);
  rememberBoard(board);

  if (!kvBound(env)) {
    memoryBag().state = state;
    return { persisted: true, degraded: false };
  }

  try {
    const payload = JSON.stringify(state);
    const snap = JSON.stringify({ board, at: Date.now() });
    await Promise.all([env.BOARD!.put('ultra:state', payload), env.BOARD!.put('ultra:board', snap)]);
    return { persisted: true, degraded: false };
  } catch {
    return { persisted: false, degraded: true };
  }
}
