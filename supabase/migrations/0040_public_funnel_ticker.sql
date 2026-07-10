-- Public FOMO funnel ticker for participants who already have a referral link.
-- Additive only: new SECURITY DEFINER RPC (does not change get_public_recent_activity).
-- Privacy: no visitor_id, no ip_hash, no user_agent — only coarse step + optional country + public codes.

CREATE OR REPLACE FUNCTION public.get_public_funnel_ticker(p_limit int DEFAULT 24)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lim AS (
    SELECT GREATEST(COALESCE(p_limit, 24), 1) AS n
  ),
  recent_funnel AS (
    -- Index-friendly: per-step LIMIT via (event_name, created_at DESC)
    SELECT v.event_name AS step, v.country_code, v.created_at, 'funnel'::TEXT AS kind,
           NULL::TEXT AS referrer_code, NULL::TEXT AS platform
    FROM (
      SELECT event_name, country_code, created_at
      FROM public.visitor_events
      WHERE event_name = 'GetReferralLink'
      ORDER BY created_at DESC
      LIMIT (SELECT GREATEST(n, 8) FROM lim)
    ) v
    UNION ALL
    SELECT v.event_name, v.country_code, v.created_at, 'funnel', NULL, NULL
    FROM (
      SELECT event_name, country_code, created_at
      FROM public.visitor_events
      WHERE event_name = 'CopyReferralLink'
      ORDER BY created_at DESC
      LIMIT (SELECT GREATEST(n / 2, 4) FROM lim)
    ) v
    UNION ALL
    SELECT v.event_name, v.country_code, v.created_at, 'funnel', NULL, NULL
    FROM (
      SELECT event_name, country_code, created_at
      FROM public.visitor_events
      WHERE event_name = 'ShareReferral'
      ORDER BY created_at DESC
      LIMIT (SELECT GREATEST(n / 2, 4) FROM lim)
    ) v
    UNION ALL
    SELECT v.event_name, v.country_code, v.created_at, 'funnel', NULL, NULL
    FROM (
      SELECT event_name, country_code, created_at
      FROM public.visitor_events
      WHERE event_name = 'OpenPrizeClaim'
      ORDER BY created_at DESC
      LIMIT (SELECT GREATEST(n / 4, 2) FROM lim)
    ) v
    UNION ALL
    SELECT v.event_name, v.country_code, v.created_at, 'funnel', NULL, NULL
    FROM (
      SELECT event_name, country_code, created_at
      FROM public.visitor_events
      WHERE event_name = 'SubmitPrizeClaim'
      ORDER BY created_at DESC
      LIMIT (SELECT GREATEST(n / 4, 2) FROM lim)
    ) v
  ),
  recent_referrals AS (
    SELECT
      'referral'::TEXT AS kind,
      r.referrer_code,
      NULL::TEXT AS platform,
      NULL::TEXT AS step,
      NULL::TEXT AS country_code,
      r.created_at
    FROM (
      SELECT referrer_code, referred_ip, user_agent, created_at
      FROM public.referrals
      ORDER BY created_at DESC
      LIMIT (SELECT GREATEST(n * 2, 16) FROM lim)
    ) r
    WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
  ),
  recent_shares AS (
    SELECT
      'share'::TEXT AS kind,
      upper(btrim(s.referrer_code)) AS referrer_code,
      s.platform,
      NULL::TEXT AS step,
      NULL::TEXT AS country_code,
      s.created_at
    FROM (
      SELECT referrer_code, platform, created_at
      FROM public.shares
      WHERE btrim(coalesce(referrer_code, '')) <> ''
      ORDER BY created_at DESC
      LIMIT (SELECT GREATEST(n * 2, 16) FROM lim)
    ) s
    WHERE NOT public.is_test_referrer_code(s.referrer_code)
  ),
  merged AS (
    SELECT kind, referrer_code, platform, step, country_code, created_at FROM recent_funnel
    UNION ALL
    SELECT kind, referrer_code, platform, step, country_code, created_at FROM recent_referrals
    UNION ALL
    SELECT kind, referrer_code, platform, step, country_code, created_at FROM recent_shares
  ),
  capped AS (
    SELECT kind, referrer_code, platform, step, country_code, created_at
    FROM merged
    ORDER BY created_at DESC
    LIMIT (SELECT n FROM lim)
  )
  SELECT COALESCE(
    (SELECT json_agg(json_build_object(
      'kind', c.kind,
      'step', c.step,
      'referrer_code', c.referrer_code,
      'platform', c.platform,
      'country_code', c.country_code,
      'created_at', c.created_at
    ) ORDER BY c.created_at DESC) FROM capped c),
    '[]'::JSON
  );
$$;

COMMENT ON FUNCTION public.get_public_funnel_ticker(int) IS
  'Worldwide FOMO ticker rows: anonymized important funnel steps + public referral/share events (no PII).';

GRANT EXECUTE ON FUNCTION public.get_public_funnel_ticker(int) TO anon, authenticated;
