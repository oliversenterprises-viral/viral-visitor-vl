-- Disk IO relief: stop full-table sequential scans on tiny hot tables.
-- Public homepage polls get_public_recent_activity + get_leaderboard often.
-- Old UNION ALL scanned all referrals/shares then sorted (burns Disk IO Budget).
-- New plan: index-friendly ORDER BY created_at DESC LIMIT first, then filter.

CREATE OR REPLACE FUNCTION public.get_public_recent_activity(p_limit int DEFAULT 8)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent_referrals AS (
    SELECT
      r.referrer_code,
      r.referred_ip,
      r.user_agent,
      r.created_at
    FROM public.referrals r
    ORDER BY r.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 8) * 4, 16)
  ),
  recent_shares AS (
    SELECT
      upper(btrim(s.referrer_code)) AS referrer_code,
      s.platform,
      s.created_at
    FROM public.shares s
    WHERE btrim(coalesce(s.referrer_code, '')) <> ''
    ORDER BY s.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 8) * 4, 16)
  ),
  merged AS (
    SELECT
      'referral'::TEXT AS kind,
      rr.referrer_code,
      NULL::TEXT AS platform,
      rr.created_at
    FROM recent_referrals rr
    WHERE NOT public.is_test_referral_row(rr.referrer_code, rr.referred_ip, rr.user_agent)

    UNION ALL

    SELECT
      'share'::TEXT AS kind,
      rs.referrer_code,
      rs.platform,
      rs.created_at
    FROM recent_shares rs
    WHERE NOT public.is_test_referrer_code(rs.referrer_code)
  ),
  capped AS (
    SELECT kind, referrer_code, platform, created_at
    FROM merged
    ORDER BY created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 8), 1)
  ),
  velocity AS (
    SELECT COUNT(*)::INTEGER AS velocity_last_hour
    FROM public.referrals r
    WHERE r.created_at >= NOW() - INTERVAL '1 hour'
      AND NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
  )
  SELECT json_build_object(
    'rows',
    COALESCE(
      (SELECT json_agg(json_build_object(
        'kind', c.kind,
        'referrer_code', c.referrer_code,
        'platform', c.platform,
        'created_at', c.created_at
      ) ORDER BY c.created_at DESC) FROM capped c),
      '[]'::JSON
    ),
    'velocity_last_hour', (SELECT velocity_last_hour FROM velocity)
  );
$$;

COMMENT ON FUNCTION public.get_public_recent_activity(int) IS
  'Public homepage activity feed (index-friendly LIMIT path for Disk IO).';

-- Ensure created_at indexes exist for ORDER BY ... LIMIT plans
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_created_at ON public.shares (created_at DESC);

-- Prune old high-churn analytics (keeps last 30 days) — safe, non-user-facing
DELETE FROM public.visitor_events
WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM public.interaction_events
WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM public.banner_events
WHERE created_at < NOW() - INTERVAL '30 days';

-- Refresh planner stats after prune
ANALYZE public.referrals;
ANALYZE public.shares;
ANALYZE public.visitor_events;
ANALYZE public.interaction_events;
ANALYZE public.banner_events;
ANALYZE public.site_content;
