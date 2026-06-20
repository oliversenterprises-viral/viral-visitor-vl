-- Prod-schema RPCs (referrals table — no profiles dependency)
CREATE OR REPLACE FUNCTION public.get_leaderboard(min_referrals int DEFAULT 1)
RETURNS TABLE (referrer_code TEXT, referral_count INTEGER, rank INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sub.referrer_code, sub.cnt,
    ROW_NUMBER() OVER (ORDER BY sub.cnt DESC, sub.referrer_code ASC)::INTEGER AS rank
  FROM (
    SELECT r.referrer_code, COUNT(*)::INTEGER AS cnt
    FROM public.referrals r
    GROUP BY r.referrer_code
    HAVING COUNT(*) >= COALESCE(min_referrals, 1)
  ) sub
  ORDER BY sub.cnt DESC, sub.referrer_code ASC
  LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_total_referral_count()
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER FROM public.referrals;
$$;
GRANT EXECUTE ON FUNCTION public.get_total_referral_count() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_referral_count(p_referrer_code TEXT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER FROM public.referrals WHERE referrer_code = p_referrer_code;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_referral_count(TEXT) TO anon, authenticated;