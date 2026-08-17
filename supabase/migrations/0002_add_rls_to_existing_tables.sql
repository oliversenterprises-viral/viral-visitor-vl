-- ============================================================================
-- SAFE RLS MIGRATION FOR EXISTING DATABASE
-- Generated for your current tables (based on what you showed me)
-- ============================================================================
-- This script does NOT try to create tables.
-- It only adds security rules (RLS) to the tables that already exist.
-- Fresh preview replay has 0001 tables only. Leftover public.claims is absent
-- after 0028 / on empty preview — skip it. Do not recreate claims.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.enable_rls_if_exists(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RAISE NOTICE 'skip RLS enable for public.% — table not present', p_table;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.create_policy_if_table(p_table text, p_sql text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RAISE NOTICE 'skip policy on public.% — table not present', p_table;
    RETURN;
  END IF;
  EXECUTE p_sql;
END;
$$;

-- Enable RLS on leftover/prod tables only when they exist
SELECT pg_temp.enable_rls_if_exists('referrals');
SELECT pg_temp.enable_rls_if_exists('shares');
SELECT pg_temp.enable_rls_if_exists('claims');
SELECT pg_temp.enable_rls_if_exists('submissions');
SELECT pg_temp.enable_rls_if_exists('winner_submissions');
SELECT pg_temp.enable_rls_if_exists('participants');
SELECT pg_temp.enable_rls_if_exists('referrers');
SELECT pg_temp.enable_rls_if_exists('site_content');
SELECT pg_temp.enable_rls_if_exists('config');
SELECT pg_temp.enable_rls_if_exists('campaign_events');
SELECT pg_temp.enable_rls_if_exists('site_analytics');

-- ============================================================================
-- PUBLIC READ POLICIES (what normal visitors can see)
-- ============================================================================

SELECT pg_temp.create_policy_if_table('referrals', $sql$
CREATE POLICY "Public can read referrals for leaderboard"
ON public.referrals
FOR SELECT
TO anon, authenticated
USING (true)
$sql$);

SELECT pg_temp.create_policy_if_table('referrers', $sql$
CREATE POLICY "Public can read referrers"
ON public.referrers
FOR SELECT
TO anon, authenticated
USING (true)
$sql$);

SELECT pg_temp.create_policy_if_table('winner_submissions', $sql$
CREATE POLICY "Public can read approved winners"
ON public.winner_submissions
FOR SELECT
TO anon, authenticated
USING (status IN ('approved', 'paid'))
$sql$);

SELECT pg_temp.create_policy_if_table('site_content', $sql$
CREATE POLICY "Public can read site content"
ON public.site_content
FOR SELECT
TO anon, authenticated
USING (true)
$sql$);

-- ============================================================================
-- RESTRICTIVE POLICIES (normal users cannot write directly)
-- ============================================================================

SELECT pg_temp.create_policy_if_table('referrals', $sql$
CREATE POLICY "Only service_role can write to referrals"
ON public.referrals
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false)
$sql$);

SELECT pg_temp.create_policy_if_table('shares', $sql$
CREATE POLICY "Only service_role can write to shares"
ON public.shares
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false)
$sql$);

SELECT pg_temp.create_policy_if_table('claims', $sql$
CREATE POLICY "Only service_role can write to claims"
ON public.claims
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false)
$sql$);

SELECT pg_temp.create_policy_if_table('submissions', $sql$
CREATE POLICY "Only service_role can write to submissions"
ON public.submissions
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false)
$sql$);

SELECT pg_temp.create_policy_if_table('winner_submissions', $sql$
CREATE POLICY "Only service_role can write to winner_submissions"
ON public.winner_submissions
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false)
$sql$);

SELECT pg_temp.create_policy_if_table('participants', $sql$
CREATE POLICY "Only service_role can write to participants"
ON public.participants
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false)
$sql$);

SELECT pg_temp.create_policy_if_table('referrers', $sql$
CREATE POLICY "Only service_role can write to referrers"
ON public.referrers
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false)
$sql$);

-- ============================================================================
-- SERVICE_ROLE POLICIES (Edge Functions can do everything)
-- ============================================================================

SELECT pg_temp.create_policy_if_table('referrals', $sql$
CREATE POLICY "Service role can do everything on referrals"
ON public.referrals
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('shares', $sql$
CREATE POLICY "Service role can do everything on shares"
ON public.shares
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('claims', $sql$
CREATE POLICY "Service role can do everything on claims"
ON public.claims
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('submissions', $sql$
CREATE POLICY "Service role can do everything on submissions"
ON public.submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('winner_submissions', $sql$
CREATE POLICY "Service role can do everything on winner_submissions"
ON public.winner_submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('participants', $sql$
CREATE POLICY "Service role can do everything on participants"
ON public.participants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('referrers', $sql$
CREATE POLICY "Service role can do everything on referrers"
ON public.referrers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('site_content', $sql$
CREATE POLICY "Service role can manage site_content"
ON public.site_content
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);

SELECT pg_temp.create_policy_if_table('config', $sql$
CREATE POLICY "Service role can manage config"
ON public.config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)
$sql$);
