-- ============================================================================
-- 0019_exclude_owner_ip_dobson.sql
-- Exclude new Dobson Technologies owner IP from public referral stats.
-- ============================================================================

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
    WHEN p_referred_ip = '57.138.135.240' THEN TRUE
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