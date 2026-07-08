-- 0026_drop_leftover_pii_policies.sql
-- Prod had alternate policy names + manual "testing only" policies that 0025 did not drop.
-- Re-affirm: no direct table reads on PII tables for anon or authenticated (edge/RPC only).

-- referrals
DROP POLICY IF EXISTS "Public can read referrals for leaderboard" ON public.referrals;
DROP POLICY IF EXISTS "Public can read referrals" ON public.referrals;

-- shares
DROP POLICY IF EXISTS shares_select_admin_live ON public.shares;
DROP POLICY IF EXISTS "Allow public read shares" ON public.shares;
DROP POLICY IF EXISTS "Public can read shares" ON public.shares;

-- visitor_events
DROP POLICY IF EXISTS visitor_events_select_admin_live ON public.visitor_events;

-- banner_events
DROP POLICY IF EXISTS banner_events_select_admin_live ON public.banner_events;
DROP POLICY IF EXISTS banner_events_select_analytics ON public.banner_events;

-- prize_claims
DROP POLICY IF EXISTS prize_claims_select_admin_live ON public.prize_claims;
DROP POLICY IF EXISTS "prize_claims_select_public_approved" ON public.prize_claims;
DROP POLICY IF EXISTS prize_claims_select_own ON public.prize_claims;
DROP POLICY IF EXISTS "Allow all reads on prize_claims (testing only)" ON public.prize_claims;
DROP POLICY IF EXISTS "Allow all updates on prize_claims (testing only)" ON public.prize_claims;

-- referrers
DROP POLICY IF EXISTS "Public can read referrers" ON public.referrers;

-- Revoke direct SELECT for anon + authenticated (admin uses service_role via edge).
REVOKE SELECT ON public.referrals FROM anon, authenticated;
REVOKE SELECT ON public.shares FROM anon, authenticated;
REVOKE SELECT ON public.visitor_events FROM anon, authenticated;
REVOKE SELECT ON public.banner_events FROM anon, authenticated;
REVOKE SELECT ON public.prize_claims FROM anon, authenticated;