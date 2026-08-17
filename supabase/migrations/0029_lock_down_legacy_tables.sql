-- 0029_lock_down_legacy_tables.sql
-- Remove unused pre-ViralRefer schema + lock archived analytics tables (edge/service_role only).

-- ── Drop permissive policies on legacy tables ───────────────────────────────

-- submissions
DO $$
BEGIN
  IF to_regclass('public.submissions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "public read submissions" ON public.submissions;
    DROP POLICY IF EXISTS "public insert submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Block direct writes on submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Service role full access submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Only service_role can write to submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Service role can do everything on submissions" ON public.submissions;
  END IF;
END $$;

-- winner_submissions
DO $$
BEGIN
  IF to_regclass('public.winner_submissions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.winner_submissions;
    DROP POLICY IF EXISTS "Allow public read" ON public.winner_submissions;
    DROP POLICY IF EXISTS "Allow public update" ON public.winner_submissions;
  END IF;
END $$;

-- participants
DO $$
BEGIN
  IF to_regclass('public.participants') IS NOT NULL THEN
    DROP POLICY IF EXISTS "public read participants" ON public.participants;
    DROP POLICY IF EXISTS "public insert participants" ON public.participants;
    DROP POLICY IF EXISTS "Block direct writes on participants" ON public.participants;
    DROP POLICY IF EXISTS "Service role full access participants" ON public.participants;
    DROP POLICY IF EXISTS "Only service_role can write to participants" ON public.participants;
    DROP POLICY IF EXISTS "Service role can do everything on participants" ON public.participants;
  END IF;
END $$;

-- referrers
DO $$
BEGIN
  IF to_regclass('public.referrers') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow anon insert" ON public.referrers;
    DROP POLICY IF EXISTS "Allow anon update referrals" ON public.referrers;
    DROP POLICY IF EXISTS "Allow public read" ON public.referrers;
    DROP POLICY IF EXISTS "Public can read referrers" ON public.referrers;
    DROP POLICY IF EXISTS "Block direct writes on referrers" ON public.referrers;
    DROP POLICY IF EXISTS "Service role full access referrers" ON public.referrers;
    DROP POLICY IF EXISTS "Only service_role can write to referrers" ON public.referrers;
    DROP POLICY IF EXISTS "Service role can do everything on referrers" ON public.referrers;
  END IF;
END $$;

-- visits (archived)
DO $$
BEGIN
  IF to_regclass('public.visits') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow public read on visits for admin UI" ON public.visits;
  END IF;
END $$;

-- site_analytics (archived)
DO $$
BEGIN
  IF to_regclass('public.site_analytics') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow public insert" ON public.site_analytics;
    DROP POLICY IF EXISTS "Allow public update" ON public.site_analytics;
    DROP POLICY IF EXISTS "Policy to implement Time To Live (TTL)" ON public.site_analytics;
  END IF;
END $$;

-- config
DO $$
BEGIN
  IF to_regclass('public.config') IS NOT NULL THEN
    DROP POLICY IF EXISTS "public read config" ON public.config;
  END IF;
END $$;

-- reddit_events (archived per 0014)
DO $$
BEGIN
  IF to_regclass('public.reddit_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow public insert for reddit events (via Edge)" ON public.reddit_events;
  END IF;
END $$;

-- ── Drop empty unused legacy tables ─────────────────────────────────────────

DROP TABLE IF EXISTS public.submissions;
DROP TABLE IF EXISTS public.winner_submissions;
DROP TABLE IF EXISTS public.participants;
DROP TABLE IF EXISTS public.referrers;
DROP TABLE IF EXISTS public.campaign_events;
DROP TABLE IF EXISTS public.config;

-- ── Lock archived tables that retain historical rows ────────────────────────

DO $$
BEGIN
  IF to_regclass('public.visits') IS NOT NULL THEN
    REVOKE ALL ON public.visits FROM anon, authenticated;
    COMMENT ON TABLE public.visits IS
      'ARCHIVED: legacy visit log. No client access — admin/service_role only if needed.';
  END IF;
  IF to_regclass('public.site_analytics') IS NOT NULL THEN
    REVOKE ALL ON public.site_analytics FROM anon, authenticated;
    COMMENT ON TABLE public.site_analytics IS
      'ARCHIVED: legacy analytics row(s). No client access.';
  END IF;
  IF to_regclass('public.reddit_events') IS NOT NULL THEN
    REVOKE ALL ON public.reddit_events FROM anon, authenticated;
    COMMENT ON TABLE public.reddit_events IS
      'ARCHIVED (0014): historical Reddit ad events only. No client access. Use visitor_events for live funnel.';
  END IF;
END $$;