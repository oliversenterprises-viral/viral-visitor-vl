-- Server-side Reddit campaign funnel events (UTM reddit traffic actions)
CREATE TABLE IF NOT EXISTS public.reddit_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_medium TEXT,
  ref_code TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reddit_events_name_created ON public.reddit_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_events_created ON public.reddit_events (created_at DESC);

ALTER TABLE public.reddit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for reddit events (via Edge)"
  ON public.reddit_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.reddit_events TO anon, authenticated;

COMMENT ON TABLE public.reddit_events IS 'Funnel events from Reddit ad visitors (PageVisit, GetLink, Copy, Share, Claim).';