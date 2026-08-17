-- 0054_public_prize_pull.sql
-- Public, PII-free numbers for the homepage ad slot:
--   visits_7d = cheap daily counter (A)
--   leader_referrals = top real board count (B)
-- Does not expose codes, IPs, or visitor rows.
-- Apply with the matching frontend deploy.

CREATE OR REPLACE FUNCTION public.get_public_prize_pull()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visit_hits AS (
    SELECT COALESCE(SUM(c.hits), 0)::BIGINT AS hits
    FROM public.landing_daily_counts c
    WHERE c.day >= ((NOW() AT TIME ZONE 'utc')::date - 6)
  ),
  leader AS (
    SELECT COUNT(*)::INTEGER AS referral_count
    FROM public.referrals r
    WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
    GROUP BY r.referrer_code
    ORDER BY COUNT(*) DESC, MIN(r.created_at) ASC
    LIMIT 1
  )
  SELECT json_build_object(
    'visits_7d', (SELECT hits::INTEGER FROM visit_hits),
    'leader_referrals', COALESCE((SELECT referral_count FROM leader), 0),
    'min_for_claim', 10
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_prize_pull() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_prize_pull() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_public_prize_pull() IS
  'Homepage prize-pull proof: 7-day visit hits + top real referral count. No codes, no PII.';
