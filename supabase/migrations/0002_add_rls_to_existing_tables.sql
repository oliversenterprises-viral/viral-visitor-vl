-- ============================================================================
-- SAFE RLS MIGRATION FOR EXISTING DATABASE
-- Generated for your current tables (based on what you showed me)
-- ============================================================================
-- This script does NOT try to create tables.
-- It only adds security rules (RLS) to the tables that already exist.
-- ============================================================================

-- Enable RLS on all important tables (safe to run multiple times)
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winner_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PUBLIC READ POLICIES (what normal visitors can see)
-- ============================================================================

-- Allow anyone to read referrals (needed for the public leaderboard)
CREATE POLICY "Public can read referrals for leaderboard"
ON public.referrals
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anyone to read referrers (if used for leaderboard display)
CREATE POLICY "Public can read referrers"
ON public.referrers
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anyone to read approved/paid winner submissions (for social proof)
CREATE POLICY "Public can read approved winners"
ON public.winner_submissions
FOR SELECT
TO anon, authenticated
USING (status IN ('approved', 'paid'));

-- Allow anyone to read site_content (for dynamic text on the site)
CREATE POLICY "Public can read site content"
ON public.site_content
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- RESTRICTIVE POLICIES (normal users cannot write directly)
-- ============================================================================

-- Block normal users from inserting/updating/deleting referrals directly
-- Only Edge Functions (using service_role) will be able to write
CREATE POLICY "Only service_role can write to referrals"
ON public.referrals
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Only service_role can write to shares"
ON public.shares
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Only service_role can write to claims"
ON public.claims
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Only service_role can write to submissions"
ON public.submissions
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Only service_role can write to winner_submissions"
ON public.winner_submissions
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Only service_role can write to participants"
ON public.participants
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Only service_role can write to referrers"
ON public.referrers
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Allow authenticated users to update their own profile-like data if needed
-- (we can loosen this later if you have user profiles)

-- ============================================================================
-- SERVICE_ROLE POLICIES (Edge Functions can do everything)
-- ============================================================================

-- These policies let the Edge Functions (which use the service_role key) 
-- bypass RLS and write data safely.

CREATE POLICY "Service role can do everything on referrals"
ON public.referrals
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on shares"
ON public.shares
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on claims"
ON public.claims
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on submissions"
ON public.submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on winner_submissions"
ON public.winner_submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on participants"
ON public.participants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on referrers"
ON public.referrers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- site_content and config can be edited by service_role too
CREATE POLICY "Service role can manage site_content"
ON public.site_content
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage config"
ON public.config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- NOTES FOR YOU:
-- After running this, normal visitors will still be able to see the leaderboard,
-- but they will NOT be able to fake referrals or prize claims directly from the browser.
-- All writes must now go through the Edge Functions we created.
-- ============================================================================