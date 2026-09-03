-- 0056_junk_visit_hq_harden.sql
-- Scout / agent UA on owner-desk exclusion. Align is_test_referrer_code with SCOUT.
-- Backfill junk_hits from leftover cheap hits where quality was never incremented.
-- Does not touch quality_hits, referrals, visitor_events, GSC, or verify files.

CREATE OR REPLACE FUNCTION public.is_test_referrer_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_code IS NULL OR btrim(p_code) = '' THEN FALSE
    WHEN upper(btrim(p_code)) IN (
      'VIRAL-SMOKETEST',
      'VIRAL-READY',
      'VIRAL-E2ECLAIM',
      'VIRAL-TEST01',
      'RELAY'
    ) THEN TRUE
    WHEN upper(btrim(p_code)) IN ('SARAH_M', 'JAMES_T', 'MARIA_K', 'DAVID_R', 'EMMA_L', 'NOAH_P') THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'SMOKETEST' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'DEMOCODE' THEN TRUE
    WHEN upper(btrim(p_code)) ~ '^DEMO[0-9]+$' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'PROBE' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'TESTFIX' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'LIVECHK' THEN TRUE
    WHEN upper(btrim(p_code)) ~ 'SCOUT' THEN TRUE
    WHEN upper(btrim(p_code)) ~ '^VIRAL-E2E' THEN TRUE
    WHEN upper(btrim(p_code)) ~ '^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)' THEN TRUE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_owner_funnel_excluded_event(
  p_ref_code TEXT,
  p_ip_hash TEXT,
  p_metadata JSONB
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
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
    OR lower(coalesce(p_metadata->>'webdriver', '')) IN ('true', 't', '1')
    OR lower(coalesce(p_metadata->>'automation', '')) IN ('true', 't', '1')
    OR lower(coalesce(p_metadata->>'vr_test', '')) IN ('true', 't', '1')
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%HeadlessChrome%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%playwright%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%headless%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%vitest%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%NovaVerify%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%scout%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%cursorbot%'
    OR coalesce(p_metadata->>'user_agent', '') ILIKE '%cursor-scout%'
    OR btrim(coalesce(p_metadata->>'user_agent', '')) = 'node'
    OR coalesce(p_metadata->>'path', '') ILIKE '%localhost%',
    FALSE
  );
$$;

COMMENT ON FUNCTION public.is_owner_funnel_excluded_event(TEXT, TEXT, JSONB) IS
  'Owner-desk row filter. Always returns true/false — never NULL. Includes scout / cursor-scout UA.';

-- Historical cheap homepage hits (Scout) sat in hits with quality_hits = 0.
-- Show them on the junk tile. Do not change quality_hits or hits.
UPDATE public.landing_daily_counts
SET junk_hits = GREATEST(junk_hits, hits),
    updated_at = now()
WHERE quality_hits = 0
  AND hits > junk_hits;
