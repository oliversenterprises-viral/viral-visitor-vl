-- 0055_junk_visit_counter.sql
-- Split the cheap visit counter so rotator / owner-test hits do not dominate HQ Desk.
-- quality_hits = real homepage views (increment_landing_daily).
-- junk_hits = exchange / owner-test / webdriver (increment_landing_daily_junk).
-- Does not touch Google Search Console, verify files, or visitor_events.

ALTER TABLE public.landing_daily_counts
  ADD COLUMN IF NOT EXISTS quality_hits BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.landing_daily_counts
  ADD COLUMN IF NOT EXISTS junk_hits BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_landing_daily()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.landing_daily_counts AS t (day, hits, quality_hits)
  VALUES ((timezone('utc', now()))::date, 1, 1)
  ON CONFLICT (day) DO UPDATE
    SET hits = t.hits + 1,
        quality_hits = t.quality_hits + 1,
        updated_at = now()
  RETURNING t.quality_hits;
$$;

CREATE OR REPLACE FUNCTION public.increment_landing_daily_junk()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.landing_daily_counts AS t (day, hits, junk_hits)
  VALUES ((timezone('utc', now()))::date, 0, 1)
  ON CONFLICT (day) DO UPDATE
    SET junk_hits = t.junk_hits + 1,
        updated_at = now()
  RETURNING t.junk_hits;
$$;

REVOKE ALL ON FUNCTION public.increment_landing_daily_junk() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_landing_daily_junk() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_landing_daily_junk() TO service_role;

CREATE OR REPLACE FUNCTION public.clear_junk_landing_counts()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.landing_daily_counts
  SET junk_hits = 0,
      updated_at = now()
  WHERE junk_hits <> 0;
  SELECT json_build_object(
    'junk_hits_cleared', true,
    'quality_hits_untouched', true,
    'gsc_untouched', true
  );
$$;

REVOKE ALL ON FUNCTION public.clear_junk_landing_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_junk_landing_counts() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_junk_landing_counts() TO service_role;

COMMENT ON FUNCTION public.increment_landing_daily_junk() IS
  'Bump today UTC junk/test page-view counter. service_role only. Does not add quality_hits.';

COMMENT ON FUNCTION public.clear_junk_landing_counts() IS
  'Zero junk_hits only. quality_hits, visitor_events, and GSC stay.';

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
    SELECT
      COALESCE(SUM(c.quality_hits), 0)::BIGINT AS quality,
      COALESCE(SUM(c.junk_hits), 0)::BIGINT AS junk
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
  'Owner desk tiles: quality visit hits (junk/test excluded), unique friend/promoter landings, unique get-link, unique verified sends, unique locked codes. service_role only.';
