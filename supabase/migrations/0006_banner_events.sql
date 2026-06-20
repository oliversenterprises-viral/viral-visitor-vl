-- ============================================================================
-- supabase/migrations/0006_banner_events.sql
-- Add server-side persistence for banner performance stats (impressions/clicks)
-- This evolves the client-only MVP (localStorage in content.ts) to something
-- visible across browsers/sessions in the admin.
-- ============================================================================

CREATE TABLE public.banner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('impression', 'click')),
  label TEXT,
  redirect_url TEXT,
  key TEXT,  -- stable key from getBannerKey (label|redirectUrl or fallback)
  metadata JSONB
);

-- Index for efficient querying by key and time (for admin stats)
CREATE INDEX idx_banner_events_key_created ON public.banner_events (key, created_at DESC);
CREATE INDEX idx_banner_events_created ON public.banner_events (created_at DESC);

-- RLS: Public can insert (via Edge), but reads are admin-only via service_role in Edge.
-- We allow anon insert for public logging (with future Turnstile/rate limit in Edge).
ALTER TABLE public.banner_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for banner events (via Edge)"
  ON public.banner_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No public select policy (admin reads go through admin-action Edge with service_role).

-- Grant insert to anon/auth (reads are service_role only in Edge).
GRANT INSERT ON public.banner_events TO anon, authenticated;

COMMENT ON TABLE public.banner_events IS 'Server-side log of banner impressions and clicks for admin stats (replaces/enhances localStorage MVP). Keyed by stable banner key for aggregation.';

-- Optional: seed comment or future cleanup job for old events.