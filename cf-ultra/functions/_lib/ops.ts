import { kvBound, type UltraEnv } from './store';

export interface OpsState {
  bannedCodes: string[];
  bannedSites: string[];
  mutedCodes: string[];
  hero: string;
  lead: string;
  /** Default false: TE-tagged Get-my-link never writes a verified credit. */
  teCreditsCount: boolean;
}

export const DEFAULT_OPS: OpsState = {
  bannedCodes: [],
  bannedSites: [],
  mutedCodes: [],
  hero: 'Paste a site.\nMake it feel viral.',
  lead: 'Instant personal share link. Friends tap Get my link. The site climbs Just entered → Rising → Challenger → #1. Visits never count.',
  teCreditsCount: false,
};

const MEM = '__ULTRA_OPS__';
const g = globalThis as typeof globalThis & { [MEM]?: OpsState };

function mem(): OpsState {
  if (!g[MEM]) g[MEM] = { ...DEFAULT_OPS, bannedCodes: [], bannedSites: [], mutedCodes: [] };
  return g[MEM]!;
}

export async function loadOps(env: UltraEnv): Promise<OpsState> {
  if (!kvBound(env)) return mem();
  try {
    const raw = (await env.BOARD!.get('ultra:ops', 'json')) as Partial<OpsState> | null;
    if (!raw) return { ...DEFAULT_OPS };
    return {
      bannedCodes: raw.bannedCodes ?? [],
      bannedSites: raw.bannedSites ?? [],
      mutedCodes: raw.mutedCodes ?? [],
      hero: raw.hero || DEFAULT_OPS.hero,
      lead: raw.lead || DEFAULT_OPS.lead,
      teCreditsCount: raw.teCreditsCount === true,
    };
  } catch {
    return { ...DEFAULT_OPS };
  }
}

export async function saveOps(env: UltraEnv, ops: OpsState): Promise<void> {
  g[MEM] = ops;
  if (!kvBound(env)) return;
  await env.BOARD!.put('ultra:ops', JSON.stringify(ops));
}

export function isBanned(ops: OpsState, code?: string | null, host?: string | null): boolean {
  if (code && ops.bannedCodes.includes(code.toUpperCase())) return true;
  if (host && ops.bannedSites.includes(host.toLowerCase())) return true;
  return false;
}
