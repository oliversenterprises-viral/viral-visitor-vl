-- Keep Micro compute cheap: last-N indexes + 2s statement timeouts on desk/ladder RPCs.
-- Does not rewrite homepage copy, GSC, or visitor rows.

CREATE INDEX IF NOT EXISTS idx_visitor_events_name_created
  ON public.visitor_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_created
  ON public.visitor_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_sitelanding_created_at
  ON public.visitor_events (created_at DESC)
  WHERE (event_name = 'SiteLanding');
CREATE INDEX IF NOT EXISTS idx_visitor_events_getreferrallink_created_at
  ON public.visitor_events (created_at DESC)
  WHERE (event_name = 'GetReferralLink');
CREATE INDEX IF NOT EXISTS idx_referrals_created_at
  ON public.referrals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_created_at
  ON public.shares (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrer_links_status
  ON public.referrer_links (status);

ALTER FUNCTION public.get_owner_funnel_desk_counts(integer) SET statement_timeout = '2s';
ALTER FUNCTION public.get_public_funnel_ticker(integer) SET statement_timeout = '2s';
ALTER FUNCTION public.get_public_get_link_stats(integer) SET statement_timeout = '2s';
ALTER FUNCTION public.get_leaderboard(integer) SET statement_timeout = '2s';
ALTER FUNCTION public.get_public_recent_activity(integer) SET statement_timeout = '2s';
