import {
  createEmptyState,
  type UltraState,
} from './engine';

export interface UltraEnv {
  BOARD?: KVNamespace;
}

const MEMORY_KEY = '__VIRALREFER_ULTRA_STATE__';

type MemoryBag = {
  state: UltraState;
  demoMode: true;
};

function memoryBag(): MemoryBag {
  const g = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryBag };
  if (!g[MEMORY_KEY]) {
    g[MEMORY_KEY] = { state: createEmptyState(), demoMode: true };
  }
  return g[MEMORY_KEY]!;
}

export function kvBound(env: UltraEnv): boolean {
  return Boolean(env.BOARD && typeof env.BOARD.get === 'function');
}

export async function loadState(env: UltraEnv): Promise<{ state: UltraState; demoMode: boolean }> {
  if (!kvBound(env)) {
    const bag = memoryBag();
    return { state: bag.state, demoMode: true };
  }
  try {
    const raw = await env.BOARD!.get('ultra:state', 'json');
    if (raw && typeof raw === 'object') {
      const parsed = raw as UltraState;
      return {
        state: {
          players: parsed.players ?? {},
          sites: parsed.sites ?? {},
          actorToCode: parsed.actorToCode ?? {},
          credits: parsed.credits ?? {},
          activity: Array.isArray(parsed.activity) ? parsed.activity : [],
          kingmakers: Array.isArray(parsed.kingmakers) ? parsed.kingmakers : [],
          bannerHost: parsed.bannerHost ?? null,
        },
        demoMode: false,
      };
    }
  } catch {
    // Fresh namespace or malformed JSON — start empty, still KV-backed.
  }
  return { state: createEmptyState(), demoMode: false };
}

export async function saveState(env: UltraEnv, state: UltraState): Promise<void> {
  if (!kvBound(env)) {
    memoryBag().state = state;
    return;
  }
  await env.BOARD!.put('ultra:state', JSON.stringify(state));
}

export async function readRate(env: UltraEnv, key: string): Promise<number> {
  if (!kvBound(env)) return 0;
  const n = Number(await env.BOARD!.get(`rl:${key}`));
  return Number.isFinite(n) ? n : 0;
}

export async function bumpRate(env: UltraEnv, key: string, ttlSec: number): Promise<number> {
  if (!kvBound(env)) return 1;
  const next = (await readRate(env, key)) + 1;
  await env.BOARD!.put(`rl:${key}`, String(next), { expirationTtl: ttlSec });
  return next;
}
