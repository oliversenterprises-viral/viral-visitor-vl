-- Site-wide visitor funnel events (all traffic — landing → link → copy → share → claim)
CREATE TABLE IF NOT EXISTS public.visitor_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  utm_source TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_medium TEXT,
  ref_code TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_events_name_created ON public.visitor_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_created ON public.visitor_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_source ON public.visitor_events (utm_source, created_at DESC);

ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for visitor events (via Edge)"
  ON public.visitor_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.visitor_events TO anon, authenticated;

COMMENT ON TABLE public.visitor_events IS 'Funnel events from all site visitors (landing, get link, copy, share, claim).';