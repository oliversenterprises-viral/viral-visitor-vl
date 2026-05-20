import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { LeaderboardEntry } from './types';

// Production Supabase project (from original ViralRefer)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wqbefjzpgsezzwdrvvua.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk";

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

// Typed query helpers (safe public reads after RLS)
export async function fetchLeaderboard(minReferrals: number = 1): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_code')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('Leaderboard fetch error:', error);
    return [];
  }

  const counts: Record<string, number> = {};
  data?.forEach((row: any) => {
    counts[row.referrer_code] = (counts[row.referrer_code] || 0) + 1;
  });

  const entries = Object.entries(counts)
    .filter(([, count]) => count >= minReferrals)
    .map(([code, count]) => ({
      referrer_code: code,
      referral_count: count,
      rank: 0,
    }))
    .sort((a, b) => b.referral_count - a.referral_count)
    .slice(0, 50)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  return entries as LeaderboardEntry[];
}

export async function fetchTotalReferrers(): Promise<number> {
  const { count, error } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count || 0;
}

export async function fetchRecentActivity(limit = 8) {
  const { data } = await supabase
    .from('referrals')
    .select('referrer_code, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function fetchSiteContent(): Promise<Record<string, any>> {
  const { data } = await supabase
    .from('site_content')
    .select('*');

  const content: Record<string, any> = {};
  data?.forEach((row: any) => {
    content[row.key] = row.value;
  });
  return content;
}

// Helper to call Edge Functions (production path)
export async function callEdgeFunction(name: string, payload: any, token?: string) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (error) throw error;
  return data;
}

export default supabase;
