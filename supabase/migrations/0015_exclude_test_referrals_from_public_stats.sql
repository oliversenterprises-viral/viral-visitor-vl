-- ============================================================================
-- 0015_exclude_test_referrals_from_public_stats.sql
-- Public leaderboard/total/notifier must ignore owner/smoke/test referral rows.
-- Counts from referrals table (filtered), not raw profiles.referral_count.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_test_referrer_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_code IS NULL OR btrim(p_code) = '' THEN FALSE
    WHEN upper(btrim(p_code)) IN ('VIRAL-SMOKETEST', 'VIRAL-READY') THEN TRUE
    WHEN upper(btrim(p_code)) IN ('SARAH_M', 'JAMES_T', 'MARIA_K', 'DAVID_R', 'EMMA_L', 'NOAH_P') THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'SMOKETEST' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'DEMOCODE' THEN TRUE
    WHEN upper(btrim(p_code)) ~ '^DEMO[0-9]+$' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'PROBE' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'TESTFIX' THEN TRUE
    WHEN upper(btrim(p_code)) ~ '^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)' THEN TRUE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_test_referral_row(
  p_referrer_code TEXT,
  p_referred_ip TEXT,
  p_user_agent TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.is_test_referrer_code(p_referrer_code) THEN TRUE
    WHEN p_referred_ip = '161.38.136.60' THEN TRUE
    WHEN p_referred_ip LIKE '203.0.113.%' THEN TRUE
    WHEN coalesce(p_user_agent, '') ILIKE '%HeadlessChrome%' THEN TRUE
    WHEN coalesce(p_user_agent, '') ILIKE '%playwright%' THEN TRUE
    WHEN coalesce(p_user_agent, '') ILIKE '%headless%' THEN TRUE
    WHEN coalesce(p_user_agent, '') ILIKE '%automation%' THEN TRUE
    WHEN coalesce(p_user_agent, '') ILIKE '%smoke%' THEN TRUE
    WHEN coalesce(p_user_agent, '') ILIKE '%vitest%' THEN TRUE
    WHEN coalesce(p_user_agent, '') ILIKE '%NovaVerify%' THEN TRUE
    WHEN btrim(coalesce(p_user_agent, '')) = 'node' THEN TRUE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(min_referrals int DEFAULT 1)
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
    GROUP BY r.referrer_code
    HAVING COUNT(*) >= COALESCE(min_referrals, 1)
  ) ranked
  ORDER BY ranked.referral_count DESC, ranked.rank ASC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.get_total_referral_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.referrals r
  WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent);
$$;

CREATE OR REPLACE FUNCTION public.get_my_referral_count(p_referrer_code TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.referrals r
  WHERE r.referrer_code = p_referrer_code
    AND NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent);
$$;

COMMENT ON FUNCTION public.is_test_referral_row(TEXT, TEXT, TEXT) IS
'Owner/smoke/automation referral row — excluded from public stats and blocked at record-referral edge.';

GRANT EXECUTE ON FUNCTION public.is_test_referrer_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_test_referral_row(TEXT, TEXT, TEXT) TO anon, authenticated;