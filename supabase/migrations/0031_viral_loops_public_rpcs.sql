-- ============================================================================
-- 0031_viral_loops_public_rpcs.sql
-- Public RPCs for viral loops: weekly sprint, community meter, rival stats.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_weekly_sprint_leaderboard(p_limit int DEFAULT 10)
RETURNS TABLE (
  referrer_code TEXT,
  referral_count INTEGER,
  rank INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ranked.referrer_code,
    ranked.referral_count,
    ranked.rank
  FROM (
    SELECT
      r.referrer_code,
      COUNT(*)::INTEGER AS referral_count,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(r.created_at) ASC)::INTEGER AS rank
    FROM public.referrals r
    WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
      AND r.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY r.referrer_code
    HAVING COUNT(*) >= 1
  ) ranked
  ORDER BY ranked.referral_count DESC, ranked.rank ASC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_referral_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.referrals r
  WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
    AND r.created_at >= NOW() - INTERVAL '7 days';
$$;

CREATE OR REPLACE FUNCTION public.get_referrer_public_stats(p_referrer_code TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH counts AS (
    SELECT
      r.referrer_code,
      COUNT(*)::INTEGER AS referral_count
    FROM public.referrals r
    WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
    GROUP BY r.referrer_code
  ),
  ranked AS (
    SELECT
      c.referrer_code,
      c.referral_count,
      ROW_NUMBER() OVER (ORDER BY c.referral_count DESC)::INTEGER AS rank
    FROM counts c
  ),
  target AS (
    SELECT
      upper(btrim(p_referrer_code)) AS code
  )
  SELECT json_build_object(
    'referrer_code', COALESCE(r.referrer_code, t.code),
    'referral_count', COALESCE(r.referral_count, 0),
    'rank', r.rank,
    'on_board', (r.rank IS NOT NULL)
  )
  FROM target t
  LEFT JOIN ranked r ON upper(r.referrer_code) = t.code;
$$;

COMMENT ON FUNCTION public.get_weekly_sprint_leaderboard(int) IS
  '7-day mini-leaderboard for weekly sprint viral loop (separate from main prize board).';

COMMENT ON FUNCTION public.get_weekly_referral_count() IS
  'Total non-test referrals in the last 7 days — community unlock meter numerator.';

COMMENT ON FUNCTION public.get_referrer_public_stats(text) IS
  'Public rank + count for a referrer code — challenge/duel landing rival stats.';

GRANT EXECUTE ON FUNCTION public.get_weekly_sprint_leaderboard(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_referral_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referrer_public_stats(text) TO anon, authenticated;