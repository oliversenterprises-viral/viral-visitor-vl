-- 0017_admin_live_realtime.sql
-- Admin Live Activity hub: Supabase Realtime publication + SELECT policies.
--
-- postgres_changes delivery requires:
--   1. Table added to supabase_realtime publication
--   2. Subscribing role (anon) can SELECT the row under RLS
--
-- visitor_events / banner_events / shares were insert-only for anon; prize_claims
-- hid pending rows. This migration enables the live strip without changing writes.

-- ── Realtime publication (idempotent) ───────────────────────────────────────

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shares;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.prize_claims;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.banner_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.site_content;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

-- ── SELECT grants (realtime + admin feed bootstrap) ───────────────────────────

GRANT SELECT ON public.shares TO anon, authenticated;
GRANT SELECT ON public.visitor_events TO anon, authenticated;
GRANT SELECT ON public.banner_events TO anon, authenticated;

-- ── RLS read policies (permissive OR with existing policies) ────────────────

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shares' AND policyname = 'shares_select_admin_live'
  ) THEN
    CREATE POLICY shares_select_admin_live
      ON public.shares FOR SELECT TO anon, authenticated USING (true);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'visitor_events' AND policyname = 'visitor_events_select_admin_live'
  ) THEN
    CREATE POLICY visitor_events_select_admin_live
      ON public.visitor_events FOR SELECT TO anon, authenticated USING (true);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'banner_events' AND policyname = 'banner_events_select_admin_live'
  ) THEN
    CREATE POLICY banner_events_select_admin_live
      ON public.banner_events FOR SELECT TO anon, authenticated USING (true);
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prize_claims' AND policyname = 'prize_claims_select_admin_live'
  ) THEN
    CREATE POLICY prize_claims_select_admin_live
      ON public.prize_claims FOR SELECT TO anon, authenticated USING (true);
  END IF;
END
$do$;

COMMENT ON POLICY shares_select_admin_live ON public.shares IS
  'Admin live activity hub: anon realtime subscriber must SELECT INSERT rows.';
COMMENT ON POLICY visitor_events_select_admin_live ON public.visitor_events IS
  'Admin live activity hub: funnel events for realtime strip + bootstrap.';
COMMENT ON POLICY banner_events_select_admin_live ON public.banner_events IS
  'Admin live activity hub: banner stats events for realtime strip + bootstrap.';
COMMENT ON POLICY prize_claims_select_admin_live ON public.prize_claims IS
  'Admin live activity hub: all claim statuses visible to owner admin panel.';