-- 0025_lock_down_anon_pii.sql
-- Revert permissive anon SELECT introduced by 0002 + 0017.
-- Public reads go through SECURITY DEFINER RPCs; admin reads use admin-action (service_role).

-- ── Drop permissive admin-live / leaderboard policies ─────────────────────────

DROP POLICY IF EXISTS shares_select_admin_live ON public.shares;
DROP POLICY IF EXISTS visitor_events_select_admin_live ON public.visitor_events;
DROP POLICY IF EXISTS banner_events_select_admin_live ON public.banner_events;
DROP POLICY IF EXISTS prize_claims_select_admin_live ON public.prize_claims;

DROP POLICY IF EXISTS "Public can read referrals for leaderboard" ON public.referrals;
DROP POLICY IF EXISTS "Public can read referrers" ON public.referrers;

-- ── Revoke anon SELECT on PII-bearing tables ────────────────────────────────

REVOKE SELECT ON public.referrals FROM anon;
REVOKE SELECT ON public.shares FROM anon;
REVOKE SELECT ON public.visitor_events FROM anon;
REVOKE SELECT ON public.banner_events FROM anon;
REVOKE SELECT ON public.prize_claims FROM anon;

-- site_content + public RPCs remain the anon read surface for the marketing site.

-- ── Safe public activity feed (no IPs, UA, cashtags, or full table scans) ───

CREATE OR REPLACE FUNCTION public.get_public_recent_activity(p_limit int DEFAULT 8)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH merged AS (
    SELECT
      'referral'::TEXT AS kind,
      r.referrer_code,
      NULL::TEXT AS platform,
      r.created_at
    FROM public.referrals r
    WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)

    UNION ALL

    SELECT
      'share'::TEXT AS kind,
      upper(btrim(s.referrer_code)) AS referrer_code,
      s.platform,
      s.created_at
    FROM public.shares s
    WHERE btrim(coalesce(s.referrer_code, '')) <> ''
      AND NOT public.is_test_referrer_code(upper(btrim(s.referrer_code)))
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
    WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
      AND r.created_at >= NOW() - INTERVAL '1 hour'
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
  'Public homepage activity feed: referral + share events only (no PII). Replaces anon SELECT on referrals/shares.';

GRANT EXECUTE ON FUNCTION public.get_public_recent_activity(int) TO anon, authenticated;