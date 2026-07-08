-- 0029_lock_down_legacy_tables.sql
-- Remove unused pre-ViralRefer schema + lock archived analytics tables (edge/service_role only).

-- ── Drop permissive policies on legacy tables ───────────────────────────────

-- submissions
DROP POLICY IF EXISTS "public read submissions" ON public.submissions;
DROP POLICY IF EXISTS "public insert submissions" ON public.submissions;
DROP POLICY IF EXISTS "Block direct writes on submissions" ON public.submissions;
DROP POLICY IF EXISTS "Service role full access submissions" ON public.submissions;
DROP POLICY IF EXISTS "Only service_role can write to submissions" ON public.submissions;
DROP POLICY IF EXISTS "Service role can do everything on submissions" ON public.submissions;

-- winner_submissions
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.winner_submissions;
DROP POLICY IF EXISTS "Allow public read" ON public.winner_submissions;
DROP POLICY IF EXISTS "Allow public update" ON public.winner_submissions;

-- participants
DROP POLICY IF EXISTS "public read participants" ON public.participants;
DROP POLICY IF EXISTS "public insert participants" ON public.participants;
DROP POLICY IF EXISTS "Block direct writes on participants" ON public.participants;
DROP POLICY IF EXISTS "Service role full access participants" ON public.participants;
DROP POLICY IF EXISTS "Only service_role can write to participants" ON public.participants;
DROP POLICY IF EXISTS "Service role can do everything on participants" ON public.participants;

-- referrers
DROP POLICY IF EXISTS "Allow anon insert" ON public.referrers;
DROP POLICY IF EXISTS "Allow anon update referrals" ON public.referrers;
DROP POLICY IF EXISTS "Allow public read" ON public.referrers;
DROP POLICY IF EXISTS "Public can read referrers" ON public.referrers;
DROP POLICY IF EXISTS "Block direct writes on referrers" ON public.referrers;
DROP POLICY IF EXISTS "Service role full access referrers" ON public.referrers;
DROP POLICY IF EXISTS "Only service_role can write to referrers" ON public.referrers;
DROP POLICY IF EXISTS "Service role can do everything on referrers" ON public.referrers;

-- visits (archived)
DROP POLICY IF EXISTS "Allow public read on visits for admin UI" ON public.visits;

-- site_analytics (archived)
DROP POLICY IF EXISTS "Allow public insert" ON public.site_analytics;
DROP POLICY IF EXISTS "Allow public update" ON public.site_analytics;
DROP POLICY IF EXISTS "Policy to implement Time To Live (TTL)" ON public.site_analytics;

-- config
DROP POLICY IF EXISTS "public read config" ON public.config;

-- reddit_events (archived per 0014)
DROP POLICY IF EXISTS "Allow public insert for reddit events (via Edge)" ON public.reddit_events;

-- ── Drop empty unused legacy tables ─────────────────────────────────────────

DROP TABLE IF EXISTS public.submissions;
DROP TABLE IF EXISTS public.winner_submissions;
DROP TABLE IF EXISTS public.participants;
DROP TABLE IF EXISTS public.referrers;
DROP TABLE IF EXISTS public.campaign_events;
DROP TABLE IF EXISTS public.config;

-- ── Lock archived tables that retain historical rows ────────────────────────

REVOKE ALL ON public.visits FROM anon, authenticated;
REVOKE ALL ON public.site_analytics FROM anon, authenticated;
REVOKE ALL ON public.reddit_events FROM anon, authenticated;

COMMENT ON TABLE public.visits IS
  'ARCHIVED: legacy visit log. No client access — admin/service_role only if needed.';

COMMENT ON TABLE public.site_analytics IS
  'ARCHIVED: legacy analytics row(s). No client access.';

COMMENT ON TABLE public.reddit_events IS
  'ARCHIVED (0014): historical Reddit ad events only. No client access. Use visitor_events for live funnel.';