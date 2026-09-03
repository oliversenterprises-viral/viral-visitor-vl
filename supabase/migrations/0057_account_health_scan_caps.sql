-- 0057_account_health_scan_caps.sql
-- Account health after Nano pool exhaustion: last-N SiteLanding / GetReferralLink
-- must use indexes, and owner/public funnel RPCs must abort instead of seq-scanning
-- visitor_events. Does not drop rows. Does not touch GSC or verify files.

-- Last-N: WHERE event_name = $1 ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_visitor_events_name_created
  ON public.visitor_events (event_name, created_at DESC);

-- Partial indexes: cheapest last-N for the two hot HQ / homepage events.
CREATE INDEX IF NOT EXISTS idx_visitor_events_sitelanding_created_at
  ON public.visitor_events (created_at DESC)
  WHERE event_name = 'SiteLanding';

CREATE INDEX IF NOT EXISTS idx_visitor_events_getreferrallink_created_at
  ON public.visitor_events (created_at DESC)
  WHERE event_name = 'GetReferralLink';

CREATE INDEX IF NOT EXISTS idx_shares_created_at
  ON public.shares (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_created_at
  ON public.referrals (created_at DESC);

-- Cap owner-desk counts: 2s abort + index LIMIT so visitor_events cannot be seq-scanned.
CREATE OR REPLACE FUNCTION public.get_owner_funnel_desk_counts(p_days INTEGER DEFAULT 7)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '2s'
AS $$
  WITH bounds AS (
    SELECT
      NOW() - (GREATEST(LEAST(COALESCE(p_days, 7), 7), 1) * INTERVAL '1 day') AS cutoff,
      ((NOW() AT TIME ZONE 'utc')::date - (GREATEST(LEAST(COALESCE(p_days, 7), 7), 1) - 1)) AS visit_from
  ),
  visit_hits AS (
    SELECT
      COALESCE(SUM(c.quality_hits), 0)::BIGINT AS quality,
      COALESCE(SUM(c.junk_hits), 0)::BIGINT AS junk
    FROM public.landing_daily_counts c, bounds b
    WHERE c.day >= b.visit_from
  ),
  -- LIMIT 4000: index-only last-N SiteLanding (event_name + created_at DESC).
  landing_ids AS (
    SELECT DISTINCT e.visitor_id
    FROM (
      SELECT visitor_id, ref_code, ip_hash, metadata
      FROM public.visitor_events
      WHERE event_name = 'SiteLanding'
        AND created_at >= (SELECT cutoff FROM bounds)
      ORDER BY created_at DESC
      LIMIT 4000
    ) e
    WHERE btrim(coalesce(e.visitor_id, '')) <> ''
      AND public.is_owner_funnel_excluded_event(e.ref_code, e.ip_hash, e.metadata) IS NOT TRUE
      AND public.is_owner_funnel_attributed_landing(e.ref_code, e.metadata) IS TRUE
  ),
  -- LIMIT 4000: index-only last-N GetReferralLink.
  get_link_ids AS (
    SELECT DISTINCT e.visitor_id
    FROM (
      SELECT visitor_id, ref_code, ip_hash, metadata
      FROM public.visitor_events
      WHERE event_name = 'GetReferralLink'
        AND created_at >= (SELECT cutoff FROM bounds)
      ORDER BY created_at DESC
      LIMIT 4000
    ) e
    WHERE btrim(coalesce(e.visitor_id, '')) <> ''
      AND public.is_owner_funnel_excluded_event(e.ref_code, e.ip_hash, e.metadata) IS NOT TRUE
  ),
  -- LIMIT 2000: shares.created_at DESC index.
  verified_shares AS (
    SELECT DISTINCT upper(btrim(s.referrer_code)) AS code
    FROM (
      SELECT referrer_code, platform
      FROM public.shares
      WHERE created_at >= (SELECT cutoff FROM bounds)
      ORDER BY created_at DESC
      LIMIT 2000
    ) s
    WHERE public.is_owner_funnel_verified_share(s.platform)
      AND btrim(coalesce(s.referrer_code, '')) <> ''
      AND NOT public.is_test_referrer_code(s.referrer_code)
      AND upper(btrim(coalesce(s.referrer_code, ''))) !~ 'LIVECHK'
      AND upper(btrim(coalesce(s.referrer_code, ''))) !~ '^VIRAL-E2E'
  ),
  -- LIMIT 2000: referrals.created_at DESC index.
  credited AS (
    SELECT DISTINCT upper(btrim(r.referrer_code)) AS code
    FROM (
      SELECT referrer_code, referred_ip, user_agent
      FROM public.referrals
      WHERE created_at >= (SELECT cutoff FROM bounds)
      ORDER BY created_at DESC
      LIMIT 2000
    ) r
    WHERE btrim(coalesce(r.referrer_code, '')) <> ''
      AND NOT public.is_test_referral_row(
        r.referrer_code,
        r.referred_ip,
        r.user_agent
      )
  ),
  active_links AS (
    SELECT DISTINCT upper(btrim(l.referrer_code)) AS code
    FROM public.referrer_links l, bounds b
    WHERE lower(l.status) = 'active'
      AND NOT public.is_test_referrer_code(l.referrer_code)
      AND (
        COALESCE(l.first_verified_share_at, l.created_at) >= b.cutoff
        OR upper(btrim(l.referrer_code)) IN (SELECT code FROM credited)
      )
  ),
  locked_codes AS (
    SELECT code FROM credited
    UNION
    SELECT code FROM active_links
  )
  SELECT json_build_object(
    'window_days', GREATEST(LEAST(COALESCE(p_days, 7), 7), 1),
    'visits', (SELECT quality::INTEGER FROM visit_hits),
    'junk_visits', (SELECT junk::INTEGER FROM visit_hits),
    'friend_landings', (SELECT COUNT(*)::INTEGER FROM landing_ids),
    'landings', (SELECT COUNT(*)::INTEGER FROM landing_ids),
    'get_link', (SELECT COUNT(*)::INTEGER FROM get_link_ids),
    'share', (SELECT COUNT(*)::INTEGER FROM verified_shares),
    'locked', (SELECT COUNT(*)::INTEGER FROM locked_codes)
  );
$$;

COMMENT ON FUNCTION public.get_owner_funnel_desk_counts(INTEGER) IS
  'Owner desk tiles (2s statement_timeout). Last-N LIMIT on visitor_events/shares/referrals so they cannot sequential-scan. service_role only.';

-- Cap public ticker: 2s abort + hard p_limit + existing per-step LIMIT.
CREATE OR REPLACE FUNCTION public.get_public_funnel_ticker(p_limit int DEFAULT 24)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '2s'
AS $$
  WITH lim AS (
    -- Hard cap 48 so callers cannot request an unbounded scan.
    SELECT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48) AS n
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
  'Worldwide FOMO ticker (2s statement_timeout). Per-step LIMIT on visitor_events/shares/referrals; p_limit hard-capped at 48 so it cannot sequential-scan.';

GRANT EXECUTE ON FUNCTION public.get_public_funnel_ticker(int) TO anon, authenticated;

ANALYZE public.visitor_events;
ANALYZE public.shares;
ANALYZE public.referrals;
