import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { LeaderboardEntry, RecentActivityItem } from './types';

// CRITICAL: Secrets must come ONLY from Vite env vars (VITE_*).
// No hardcoded fallbacks. Fail hard at import time if missing — this prevents
// accidental use of prod keys or shipping builds with baked secrets.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'FATAL: Missing required Supabase environment variables.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (copy from .env.example).\n' +
    'For production builds (Cloudflare/Vercel/etc), configure these as build env vars.\n' +
    'NEVER commit real keys to source control. Rotate keys regularly via Supabase dashboard.'
  );
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Client-side fallback (pre-0005 or if RPC unavailable)
async function fetchLeaderboardFallback(minReferrals: number): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_code')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) return [];

  const counts: Record<string, number> = {};
  (data as Array<{ referrer_code: string }> | null)?.forEach((row) => {
    counts[row.referrer_code] = (counts[row.referrer_code] || 0) + 1;
  });

  return Object.entries(counts)
    .filter(([, count]) => count >= minReferrals)
    .map(([code, count]) => ({ referrer_code: code, referral_count: count, rank: 0 }))
    .sort((a, b) => b.referral_count - a.referral_count)
    .slice(0, 50)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 })) as LeaderboardEntry[];
}

// Typed query helpers — prefer 0005 RPCs, fall back safely
export async function fetchLeaderboard(minReferrals: number = 1): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', { min_referrals: minReferrals });
    if (!error && Array.isArray(data) && data.length >= 0) {
      return data as LeaderboardEntry[];
    }
  } catch {
    // RPC not deployed yet
  }
  return fetchLeaderboardFallback(minReferrals);
}

export async function fetchTotalReferrers(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_total_referral_count');
    if (!error && typeof data === 'number') return data;
  } catch {
    // fallback
  }
  const { count, error } = await supabase.from('referrals').select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

export async function fetchMyReferralCount(referrerCode: string): Promise<number> {
  if (!referrerCode) return 0;
  try {
    const { data, error } = await supabase.rpc('get_my_referral_count', { p_referrer_code: referrerCode });
    if (!error && typeof data === 'number') return data;
  } catch {
    // fallback
  }
  const { count, error } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_code', referrerCode);
  if (error) return 0;
  return count || 0;
}

export async function fetchRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
  const { data } = await supabase
    .from('referrals')
    .select('referrer_code, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data as RecentActivityItem[]) || [];
}

export async function fetchSiteContent(): Promise<Record<string, unknown>> {
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
