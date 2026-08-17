-- 0053_landing_visits_and_friend_desk.sql
-- A: cheap visit counter — one row per UTC day, increment only. No IP, no geo.
-- B: desk "landings" / friend_landings = unique /r/ and /a/ arrivals only.
-- Rotator homepage SiteLanding stays out of visitor_events (see record-visitor-event).
-- Apply with the matching Edge deploy (increment_landing_daily + desk UI).

CREATE TABLE IF NOT EXISTS public.landing_daily_counts (
  day DATE PRIMARY KEY,
  hits BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_daily_counts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.landing_daily_counts FROM PUBLIC;
REVOKE ALL ON TABLE public.landing_daily_counts FROM anon, authenticated;
GRANT ALL ON TABLE public.landing_daily_counts TO service_role;

CREATE OR REPLACE FUNCTION public.increment_landing_daily()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.landing_daily_counts AS t (day, hits)
  VALUES ((timezone('utc', now()))::date, 1)
  ON CONFLICT (day) DO UPDATE
    SET hits = t.hits + 1,
        updated_at = now()
  RETURNING t.hits;
$$;

REVOKE ALL ON FUNCTION public.increment_landing_daily() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_landing_daily() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_landing_daily() TO service_role;

COMMENT ON FUNCTION public.increment_landing_daily() IS
  'Bump today UTC page-view counter. service_role only. No visitor row.';

CREATE OR REPLACE FUNCTION public.is_owner_funnel_attributed_landing(
  p_ref_code TEXT,
  p_metadata JSONB
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    btrim(coalesce(p_ref_code, '')) <> ''
    OR btrim(coalesce(p_metadata->>'aff_code', '')) <> ''
    OR coalesce(p_metadata->>'path', '') ~* '^/r/'
    OR coalesce(p_metadata->>'path', '') ~* '^/a/',
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_owner_funnel_attributed_landing(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner_funnel_attributed_landing(TEXT, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_funnel_attributed_landing(TEXT, JSONB) TO service_role;

-- Seed last 7 UTC days from historical SiteLanding so Visits is not 0 on first apply.
INSERT INTO public.landing_daily_counts (day, hits)
SELECT (timezone('utc', e.created_at))::date AS day, COUNT(*)::bigint
FROM public.visitor_events e
WHERE e.event_name = 'SiteLanding'
  AND e.created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1
ON CONFLICT (day) DO UPDATE
  SET hits = GREATEST(public.landing_daily_counts.hits, EXCLUDED.hits);

CREATE OR REPLACE FUNCTION public.get_owner_funnel_desk_counts(p_days INTEGER DEFAULT 7)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      NOW() - (GREATEST(COALESCE(p_days, 7), 1) * INTERVAL '1 day') AS cutoff,
      ((NOW() AT TIME ZONE 'utc')::date - (GREATEST(COALESCE(p_days, 7), 1) - 1)) AS visit_from
  ),
  visit_hits AS (
    SELECT COALESCE(SUM(c.hits), 0)::BIGINT AS hits
    FROM public.landing_daily_counts c, bounds b
    WHERE c.day >= b.visit_from
  ),
  landing_ids AS (
    SELECT DISTINCT e.visitor_id
    FROM public.visitor_events e, bounds b
    WHERE e.event_name = 'SiteLanding'
      AND e.created_at >= b.cutoff
      AND btrim(coalesce(e.visitor_id, '')) <> ''
      AND public.is_owner_funnel_excluded_event(e.ref_code, e.ip_hash, e.metadata) IS NOT TRUE
      AND public.is_owner_funnel_attributed_landing(e.ref_code, e.metadata) IS TRUE
  ),
  get_link_ids AS (
    SELECT DISTINCT e.visitor_id
    FROM public.visitor_events e, bounds b
    WHERE e.event_name = 'GetReferralLink'
      AND e.created_at >= b.cutoff
      AND btrim(coalesce(e.visitor_id, '')) <> ''
      AND public.is_owner_funnel_excluded_event(e.ref_code, e.ip_hash, e.metadata) IS NOT TRUE
  ),
  verified_shares AS (
    SELECT DISTINCT upper(btrim(s.referrer_code)) AS code
    FROM public.shares s, bounds b
    WHERE s.created_at >= b.cutoff
      AND public.is_owner_funnel_verified_share(s.platform)
      AND btrim(coalesce(s.referrer_code, '')) <> ''
      AND NOT public.is_test_referrer_code(s.referrer_code)
      AND upper(btrim(coalesce(s.referrer_code, ''))) !~ 'LIVECHK'
      AND upper(btrim(coalesce(s.referrer_code, ''))) !~ '^VIRAL-E2E'
  ),
  credited AS (
    SELECT DISTINCT upper(btrim(r.referrer_code)) AS code
    FROM public.referrals r, bounds b
    WHERE r.created_at >= b.cutoff
      AND btrim(coalesce(r.referrer_code, '')) <> ''
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
    'window_days', GREATEST(COALESCE(p_days, 7), 1),
    'visits', (SELECT hits::INTEGER FROM visit_hits),
    'friend_landings', (SELECT COUNT(*)::INTEGER FROM landing_ids),
    'landings', (SELECT COUNT(*)::INTEGER FROM landing_ids),
    'get_link', (SELECT COUNT(*)::INTEGER FROM get_link_ids),
    'share', (SELECT COUNT(*)::INTEGER FROM verified_shares),
    'locked', (SELECT COUNT(*)::INTEGER FROM locked_codes)
  );
$$;

COMMENT ON FUNCTION public.get_owner_funnel_desk_counts(INTEGER) IS
  'Owner desk tiles: visit hits (daily counter), unique friend/promoter landings, unique get-link, unique verified sends, unique locked codes. service_role only.';
