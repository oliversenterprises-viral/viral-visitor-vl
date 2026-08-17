-- Phase 0: hide reserved RELAY junk row from public boards; strip cash-bonus notes.
-- Align is_test_referrer_code with supabase/functions/_shared/test-referral.ts.

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
    WHEN upper(btrim(p_code)) ~ '^VIRAL-E2E' THEN TRUE
    WHEN upper(btrim(p_code)) ~ '^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)' THEN TRUE
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.is_test_referrer_code(TEXT) IS
  'Reserved / smoke / junk referrer codes hidden from public boards. RELAY is a first-party test/exchange stub, not a person.';
