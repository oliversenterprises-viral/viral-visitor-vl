-- 0050_owner_funnel_desk_counts.sql
-- Owner desk tiles: server-side DISTINCT counts for the last N days.
-- Not last-1000. Not a paged visitor_events dump. service_role only.

CREATE OR REPLACE FUNCTION public.is_owner_funnel_excluded_event(
  p_ref_code TEXT,
  p_ip_hash TEXT,
  p_metadata JSONB
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    public.is_test_referrer_code(p_ref_code)
    OR public.is_test_referrer_code(p_metadata->>'code')
    OR public.is_test_referrer_code(p_metadata->>'my_code')
    OR upper(btrim(coalesce(p_ref_code, ''))) ~ 'LIVECHK'
    OR upper(btrim(coalesce(p_ref_code, ''))) ~ '^VIRAL-E2E'
    OR upper(btrim(coalesce(p_ref_code, ''))) IN ('VIRAL-E2ECLAIM', 'VIRAL-TEST01')
    OR coalesce(p_metadata->>'client_ip', '') IN ('161.38.136.60', '57.138.135.240')
    OR coalesce(p_metadata->>'client_ip', '') LIKE '203.0.113.%'
    OR lower(coalesce(p_ip_hash, '')) LIKE 'd8399295624890754c844c12%'
    OR lower(coalesce(p_ip_hash, '')) LIKE '717ece42045d3673ed7fb81c%'
    OR coalesce(p_metadata->>'webdriver', '') IN ('true', 't', '1')
    OR (p_metadata -> 'webdriver') = 'true'::jsonb
    OR coalesce(p_metadata->>'automation', '') IN ('true', 't', '1')
    OR (p_metadata -> 'automation') = 'true'::jsonb
    OR coalesce(p_metadata->>'vr_test', '') IN ('true', 't', '1')
    OR (p_metadata -> 'vr_test') = 'true'::jsonb
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%HeadlessChrome%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%playwright%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%headless%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%automation%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%vitest%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%NovaVerify%'
    OR btrim(coalesce(p_metadata->>'user_agent', '')) = 'node'
    OR coalesce(p_metadata->>'path', '') ILIKE '%localhost%';
$$;

CREATE OR REPLACE FUNCTION public.is_owner_funnel_verified_share(p_platform TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT (
    lower(btrim(coalesce(p_platform, ''))) IN (
      '',
      'copy',
      'copy-message',
      'copy-code',
      'clipboard',
      'embed',
      'markdown',
      'other',
      'discord',
      'tiktok',
      'snapchat',
      'story-image',
      'x-image',
      'share-pack',
      'winner-pack',
      'first_referral',
      'intent',
      'intent-open'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_owner_funnel_desk_counts(p_days INTEGER DEFAULT 7)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT NOW() - (GREATEST(COALESCE(p_days, 7), 1) * INTERVAL '1 day') AS cutoff
  ),
  landing_ids AS (
    SELECT DISTINCT e.visitor_id
    FROM public.visitor_events e, bounds b
    WHERE e.event_name = 'SiteLanding'
      AND e.created_at >= b.cutoff
      AND btrim(coalesce(e.visitor_id, '')) <> ''
      AND NOT public.is_owner_funnel_excluded_event(e.ref_code, e.ip_hash, e.metadata)
  ),
  get_link_ids AS (
    SELECT DISTINCT e.visitor_id
    FROM public.visitor_events e, bounds b
    WHERE e.event_name = 'GetReferralLink'
      AND e.created_at >= b.cutoff
      AND btrim(coalesce(e.visitor_id, '')) <> ''
      AND NOT public.is_owner_funnel_excluded_event(e.ref_code, e.ip_hash, e.metadata)
  ),
  verified_shares AS (
    SELECT s.id
    FROM public.shares s, bounds b
    WHERE s.created_at >= b.cutoff
      AND public.is_owner_funnel_verified_share(s.platform)
      AND lower(btrim(coalesce(s.platform, ''))) = 'native'
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
    'landings', (SELECT COUNT(*)::INTEGER FROM landing_ids),
    'get_link', (SELECT COUNT(*)::INTEGER FROM get_link_ids),
    'share', (SELECT COUNT(*)::INTEGER FROM verified_shares),
    'locked', (SELECT COUNT(*)::INTEGER FROM locked_codes)
  );
$$;

REVOKE ALL ON FUNCTION public.is_owner_funnel_excluded_event(TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner_funnel_excluded_event(TEXT, TEXT, JSONB) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_owner_funnel_verified_share(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner_funnel_verified_share(TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_owner_funnel_desk_counts(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_owner_funnel_desk_counts(INTEGER) FROM anon, authenticated;

COMMENT ON FUNCTION public.get_owner_funnel_desk_counts(INTEGER) IS
  'Owner desk tiles: COUNT DISTINCT landings/get-link, verified shares, unique locked codes. service_role only.';



GRANT EXECUTE ON FUNCTION public.get_owner_funnel_desk_counts(INTEGER) TO service_role;

