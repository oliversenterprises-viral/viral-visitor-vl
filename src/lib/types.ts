/**
 * ViralRefer Premium — Core TypeScript Domain Models
 * 
 * All interfaces are designed for direct mapping to Supabase Postgres tables
 * via Row/Insert/Update types. Use with @supabase/supabase-js typed client.
 * 
 * Tables expected:
 *   profiles, referrals, shares, prize_claims (renamed from claims in 0004 migration), site_content
 * 
 * Realtime subscriptions and RLS policies should align 1:1 with these shapes.
 */

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type ReferralStatus = 'pending' | 'completed' | 'rewarded';
export type SharePlatform = 'twitter' | 'linkedin' | 'facebook' | 'email' | 'copy' | 'whatsapp' | 'telegram';
export type PrizeClaimStatus = 'pending' | 'approved' | 'shipped' | 'fulfilled' | 'rejected';
export type ContentType = 'text' | 'json' | 'html' | 'image' | 'markdown';

/** Lightweight shape used by current leaderboard queries (simple referrer_code + count) */
export interface LeaderboardEntry {
  referrer_code: string;
  referral_count: number;
  rank: number;
}

/** User profile (extends Supabase auth.users via public.profiles) */
export interface Profile {
  id: string;                    // UUID from auth.users
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  referral_code: string;         // Unique, short, uppercase e.g. "VIRAL-X7K9P"
  referred_by: string | null;    // referral_code of the person who referred this user
  points: number;                // Lifetime points (never decreases)
  tier: Tier;
  total_referrals: number;       // Count of successful completed referrals
  total_shares: number;
  created_at: string;            // ISO timestamp
  updated_at: string;
  // Optional metadata for future expansion
  metadata?: Record<string, unknown>;
}

/** A referral relationship */
export interface Referral {
  id: string;
  referrer_id: string;           // FK -> profiles.id
  referred_id: string;           // FK -> profiles.id (the new user)
  referred_email?: string;       // For pending invites before signup
  status: ReferralStatus;
  points_awarded: number;        // Points given to referrer upon completion
  created_at: string;
  completed_at: string | null;
  // Optional campaign or source tracking
  source?: string;
}

/** Individual share action (for analytics + anti-abuse) */
export interface Share {
  id: string;
  user_id: string;               // FK -> profiles.id
  platform: SharePlatform;
  referral_link: string;         // The exact link shared (contains referral_code)
  metadata?: {
    message?: string;
    utm_campaign?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

/** Prize claim record */
export interface PrizeClaim {
  id: string;
  user_id: string;               // FK -> profiles.id
  prize_id: string;              // e.g. "airpods-pro", "macbook-air", "custom-swag"
  prize_name: string;            // Human readable at time of claim
  points_cost: number;
  status: PrizeClaimStatus;
  // Flexible payload for shipping address, size, email, etc.
  claim_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
  admin_notes?: string;
}

/** CMS-style editable content for the marketing site (hero copy, prize catalog, FAQ, etc.) */
export interface SiteContent {
  id: string;
  key: string;                   // Unique slug e.g. "hero_title", "prizes", "terms"
  value: string | number | boolean | Record<string, unknown> | unknown[];
  type: ContentType;
  description?: string;
  updated_at: string;
  updated_by?: string;           // admin user id
}

// NOTE: The active LeaderboardEntry (lightweight shape for current queries) is defined above near line 20.
// A richer denormalized row (with user profile fields + period points) can be added later as `LeaderboardRow`
// if Edge Functions or views start returning the full shape. The previous duplicate definition has been removed
// to keep the module's exported types unambiguous.

/** Utility: minimal public profile for sharing / display (no sensitive fields) */
export interface PublicProfile {
  full_name: string | null;
  avatar_url: string | null;
  referral_code: string;
  tier: Tier;
  points: number;
  total_referrals: number;
}

/** API response wrapper for consistency */
export interface ApiResponse<T> {
  data: T | null;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

/** Prize definition (static or from site_content) */
export interface Prize {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  image_url?: string;
  stock?: number | 'unlimited';
  tier_required?: Tier;
  active: boolean;
}

// Type guards (useful in feature modules)
export function isValidTier(tier: string): tier is Tier {
  return ['bronze', 'silver', 'gold', 'platinum'].includes(tier);
}

export function isCompletedReferral(referral: Referral): boolean {
  return referral.status === 'completed' || referral.status === 'rewarded';
}

// --- Share Analytics types (ADR-002) ---
export type TimePeriod = 7 | 30 | 0;

export interface ShareRecord {
  platform: string;
  referrer_code: string;
  created_at: string;
  referral_link?: string;
  user_id?: string;
}

export interface KeyInsight {
  id: string;
  icon: string;
  title: string;
  value: string | number;
  detail?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  percentage?: number;
}

export interface AnalyticsSummary {
  total: number;
  uniqueReferrers: number;
  platformCounts: Record<string, number>;
  topReferrers: Array<[string, number]>;
  dailyTrend: { labels: string[]; values: number[] };
  keyInsights: KeyInsight[];
  cumulativeTrend?: { labels: string[]; values: number[] };
  bestDayOfWeek?: string;
  avgPerDay?: number;
}

/** Shape returned by fetchRecentActivity (used in public homepage) */
export interface RecentActivityItem {
  referrer_code: string;
  created_at: string;
}
