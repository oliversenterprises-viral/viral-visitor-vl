import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { LeaderboardEntry, RecentActivityItem } from './types';
import { createSupabaseStub } from './supabase-stub';
import type { PublicActivityRow } from './public-activity';

// CRITICAL: Secrets must come ONLY from Vite env vars (VITE_*).
// Production deploys (Vercel) inject real values at build time.
// Local/preview without env degrades to static shell — no import-time crash.
function envString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const SUPABASE_URL = envString(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = envString(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    '[ViralRefer] Supabase env not configured — static/degraded mode. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for live leaderboard/content.',
  );
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createSupabaseStub();

// Typed query helpers — prefer SECURITY DEFINER RPCs (no direct referrals table reads)
export async function fetchLeaderboard(minReferrals: number = 1): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', { min_referrals: minReferrals });
    if (!error && Array.isArray(data)) {
      return data as LeaderboardEntry[];
    }
  } catch {
    // RPC unavailable
  }
  return [];
}

export async function fetchTotalReferrers(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const { data, error } = await supabase.rpc('get_total_referral_count');
    if (!error && typeof data === 'number') return data;
  } catch {
    // RPC unavailable
  }
  return 0;
}

/** Distinct real referrers (Phase 3 trust pack). Falls back to leaderboard size. */
export async function fetchUniqueReferrerCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const { data, error } = await supabase.rpc('get_unique_referrer_count');
    if (!error && typeof data === 'number') return data;
  } catch {
    // RPC may not exist until migration 0018
  }
  try {
    const board = await fetchLeaderboard(1);
    return board.length;
  } catch {
    return 0;
  }
}

/** Public leaderboard rank for a referrer (null if not on board). */
export async function fetchMyLeaderboardRank(referrerCode: string): Promise<number | null> {
  if (!referrerCode || !isSupabaseConfigured) return null;
  try {
    const board = await fetchLeaderboard(1);
    const code = referrerCode.trim().toUpperCase();
    const entry = board.find((e) => (e.referrer_code || '').toUpperCase() === code);
    return entry?.rank ?? null;
  } catch {
    return null;
  }
}

export async function fetchMyReferralCount(referrerCode: string): Promise<number> {
  if (!referrerCode || !isSupabaseConfigured) return 0;
  try {
    const { data, error } = await supabase.rpc('get_my_referral_count', { p_referrer_code: referrerCode });
    if (!error && typeof data === 'number') return data;
  } catch {
    // RPC unavailable
  }
  return 0;
}

export async function fetchRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
  const { rows } = await fetchPublicRecentActivity(limit);
  return rows;
}

/** Public feed via get_public_recent_activity RPC (no anon table SELECT). */
export async function fetchPublicRecentActivity(limit = 8): Promise<{
  rows: PublicActivityRow[];
  velocityLastHour: number;
}> {
  if (!isSupabaseConfigured) return { rows: [], velocityLastHour: 0 };

  const fetchLimit = Math.max(limit * 2, 12);

  try {
    const { data, error } = await supabase.rpc('get_public_recent_activity', {
      p_limit: fetchLimit,
    });
    if (!error && data && typeof data === 'object') {
      const payload = data as {
        rows?: Array<{
          kind?: string;
          referrer_code?: string;
          platform?: string | null;
          created_at?: string;
        }>;
        velocity_last_hour?: number;
      };
      const rows = (payload.rows || [])
        .filter((row) => row.referrer_code && row.created_at)
        .map((row) => ({
          kind: (row.kind === 'share' ? 'share' : 'referral') as PublicActivityRow['kind'],
          referrer_code: String(row.referrer_code),
          created_at: String(row.created_at),
          platform: row.platform || undefined,
        }));
      return {
        rows: rows.slice(0, limit),
        velocityLastHour:
          typeof payload.velocity_last_hour === 'number' ? payload.velocity_last_hour : 0,
      };
    }
  } catch {
    // RPC not deployed yet
  }

  return { rows: [], velocityLastHour: 0 };
}

export async function fetchSiteContent(): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await supabase
    .from('site_content')
    .select('key, id, value');

  if (error) {
    console.warn('[ViralRefer] site_content fetch error:', error.message, error.code);
    return {};
  }

  const content: Record<string, unknown> = {};
  (data as Array<{ key?: string; id?: string; value: unknown }> | null)?.forEach((row) => {
    // Support both schemas: some code uses `id` as the logical key, others expect `key`
    const logicalKey = row.key ?? row.id;
    if (logicalKey != null) {
      content[logicalKey] = row.value;
    }
  });
  return content;
}

/**
 * Invokes a Supabase Edge Function.
 * @param name - Name of the Edge Function (e.g. "admin-action")
 * @param payload - JSON payload to send in the request body
 * @param token - Optional auth token (Bearer)
 */
export async function callEdgeFunction(name: string, payload: any, token?: string) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (error) throw error;
  return data;
}

export default supabase;
