-- 0018_unique_referrer_count_rpc.sql
-- Phase 3 referred-landing trust pack: distinct real referrers competing.

CREATE OR REPLACE FUNCTION public.get_unique_referrer_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT r.referrer_code)::INTEGER
  FROM public.referrals r
  WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent);
$$;

GRANT EXECUTE ON FUNCTION public.get_unique_referrer_count() TO anon, authenticated;

COMMENT ON FUNCTION public.get_unique_referrer_count() IS
  'Public trust-pack stat: distinct referrer codes with at least one non-test credited referral.';