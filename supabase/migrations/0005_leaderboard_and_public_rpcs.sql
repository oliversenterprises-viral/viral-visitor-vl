-- ============================================================================
-- supabase/migrations/0005_leaderboard_and_public_rpcs.sql
-- ViralRefer Premium - Sentinel Rec #3 / Data Sovereign remediation (audit item 3)
-- Created by Data Sovereign (Supabase architect on NovaCodeSwarm 13-agent team)
-- ============================================================================
--
-- PURPOSE: Move insecure client-side leaderboard aggregation (SELECT 5000 referrals +
--          JS count/sort/rank in fetchLeaderboard) to trusted DB layer.
--          Leverage existing profiles.referral_count (maintained by SECURITY DEFINER
--          triggers in 0001_init_rls.sql) + index for server-side ranking + filtering.
--
-- SECURITY (Sentinel Rec #3 - safe public leaderboard reads):
--   - Uses ONLY the public.profiles table (already granted SELECT to anon/authenticated
--     via 0001 policy "profiles_select_public_leaderboard" USING (true)).
--   - NO direct exposure of raw 'referrals' table rows to clients for aggregation.
--   - SECURITY DEFINER RPC ensures ranking logic executes with elevated privileges
--     but results are filtered/limited (no PII leak, no full table dump).
--   - RLS still enforces: anon/auth can only see public leaderboard subset.
--   - Grants EXECUTE narrowly to anon, authenticated (principle of least privilege).
--   - References: 0001_init_rls.sql Sentinel Rec #3, #5 (triggers), #6 (indexes).
--
-- BENEFITS:
--   - Zero data leakage of individual referral events.
--   - Efficient: server-side ROW_NUMBER + LIMIT 50, uses idx_profiles_referral_count.
--   - Consistent: referral_count always authoritative from trigger-maintained column.
--   - Supports min_referrals filter server-side.
--   - Public RPCs for total stats (avoids anon SELECT on restricted referrals table).
--
-- APPLY: supabase db push  (or migrate in prod/staging after backup).
-- ROLLBACK: DROP FUNCTION public.get_leaderboard(int), public.get_total_referral_count(), public.get_my_referral_count(text);
-- ============================================================================

-- Ensure extension for any uuid if needed (idempotent, though pgcrypto in 0001)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECURE PUBLIC LEADERBOARD RPC (replaces client-side aggregation)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(min_referrals int DEFAULT 1)
RETURNS TABLE (
  referrer_code TEXT,
  referral_count INTEGER,
  rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side ranking + filter + limit. Computation moved to trusted DB per Data Sovereign.
  -- Order matches the supporting index: referral_count DESC, created_at ASC (tie-breaker for stable ranks).
  RETURN QUERY
  SELECT
    p.referrer_code,
    p.referral_count,
    ROW_NUMBER() OVER (
      ORDER BY p.referral_count DESC, p.created_at ASC
    )::INTEGER AS rank
  FROM public.profiles p
  WHERE p.referral_count >= COALESCE(min_referrals, 1)
  ORDER BY p.referral_count DESC, p.created_at ASC
  LIMIT 50;
END;
$$;

COMMENT ON FUNCTION public.get_leaderboard(int) IS
'Sentinel Rec #3 safe public leaderboard: returns top 50 ranked by referral_count (from trigger-maintained profiles column). Filters by min_referrals (default 1). No raw referrals data exposed. Used by fetchLeaderboard().';

-- Narrow grants for public access (anon for unauthenticated visitors, authenticated for signed-in)
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO anon, authenticated;

-- ============================================================================
-- SUPPORTING PUBLIC RPCS FOR STATS (total + per-referrer; Data Sovereign + efficiency)
-- Replaces/backs client queries that previously hit 'referrals' (which has restrictive RLS:
-- no anon SELECT per 0001 policies; only own for auth). Uses pre-aggregated profiles data.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_total_referral_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Total successful referrals across all (sum of per-referrer counts maintained by triggers).
  -- Accurate "total referrals" metric for public stats display (id="total-referrers").
  SELECT COALESCE(SUM(referral_count), 0)::INTEGER FROM public.profiles;
$$;

COMMENT ON FUNCTION public.get_total_referral_count() IS
'Sentinel Rec #3: Public aggregate for total referral count (sum of profiles.referral_count). Safe alternative to counting raw referrals rows client-side.';

GRANT EXECUTE ON FUNCTION public.get_total_referral_count() TO anon, authenticated;

-- Per-code count for "Your Stats" section (used with optional myReferralCode even pre-auth).
CREATE OR REPLACE FUNCTION public.get_my_referral_count(p_referrer_code TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT referral_count FROM public.profiles WHERE referrer_code = p_referrer_code
  ), 0);
$$;

COMMENT ON FUNCTION public.get_my_referral_count(TEXT) IS
'Sentinel Rec #3: Efficient lookup of a specific referrer''s count from profiles (no referrals table scan). Used by fetchMyReferralCount().';

GRANT EXECUTE ON FUNCTION public.get_my_referral_count(TEXT) TO anon, authenticated;

-- ============================================================================
-- NOTES
-- - profiles.referral_count is the source of truth (incremented by handle_new_referral_increment trigger in 0001).
-- - Existing idx_profiles_referral_count supports the ORDER BY in get_leaderboard.
-- - Existing public SELECT policy + GRANT on profiles in 0001 enables safe reads.
-- - Edge Functions / service_role continue to own all mutations.
-- - After apply: verify with \df public.get_leaderboard ; SELECT * FROM get_leaderboard(0);
-- ============================================================================
-- END OF MIGRATION 0005 (leaderboard + public stats RPCs)
-- Next migrations as needed for further hardening.
-- ============================================================================
