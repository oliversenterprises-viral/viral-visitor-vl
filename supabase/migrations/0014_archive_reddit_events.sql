-- Phase 2: archive reddit_events — retain historical rows, block new client writes.
-- Reddit paid ads removed from the app; visitor_events is the canonical funnel table.

DROP POLICY IF EXISTS "Allow public insert for reddit events (via Edge)"
  ON public.reddit_events;

REVOKE INSERT ON public.reddit_events FROM anon, authenticated;

COMMENT ON TABLE public.reddit_events IS
  'ARCHIVED (Phase 2): historical Reddit ad funnel events only. No new inserts. Use visitor_events for live funnel stats.';