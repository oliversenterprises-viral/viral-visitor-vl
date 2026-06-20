-- Unique visitor + country fields for site-wide funnel analytics (additive, non-breaking)
ALTER TABLE public.visitor_events
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT;

CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_id ON public.visitor_events (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_country ON public.visitor_events (country_code, created_at DESC);

COMMENT ON COLUMN public.visitor_events.visitor_id IS 'First-party browser ID (localStorage) for unique visitor counts.';
COMMENT ON COLUMN public.visitor_events.session_id IS 'Per-tab session ID (sessionStorage).';
COMMENT ON COLUMN public.visitor_events.ip_hash IS 'SHA-256 hash of client IP (server-side); not stored raw.';
COMMENT ON COLUMN public.visitor_events.country_code IS 'ISO 3166-1 alpha-2 from edge geo header when available.';