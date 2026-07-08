-- Closed-loop viral optimizer: interaction geometry + experiment ledger

CREATE TABLE IF NOT EXISTS public.interaction_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'scroll_depth')),
  zone_id TEXT NOT NULL,
  path TEXT,
  x INTEGER,
  y INTEGER,
  viewport_w INTEGER,
  viewport_h INTEGER,
  scroll_y INTEGER,
  scroll_depth_pct INTEGER,
  visitor_id TEXT,
  session_id TEXT,
  ref_code TEXT,
  ab_variant TEXT,
  is_referred BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,
  country_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_events_zone_created
  ON public.interaction_events (zone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_events_created
  ON public.interaction_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_events_path
  ON public.interaction_events (path, created_at DESC);

ALTER TABLE public.interaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for interaction events (via Edge)"
  ON public.interaction_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.interaction_events TO anon, authenticated;

COMMENT ON TABLE public.interaction_events IS
  'Viral zone clicks and scroll depth for closed-loop optimizer (admin reads via service_role).';

CREATE TABLE IF NOT EXISTS public.optimizer_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hypothesis TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  segment TEXT NOT NULL DEFAULT 'all',
  primary_metric TEXT NOT NULL DEFAULT 'ShareReferral',
  guard_metric TEXT NOT NULL DEFAULT 'GetReferralLink',
  control_label TEXT NOT NULL DEFAULT 'control',
  treatment_label TEXT NOT NULL DEFAULT 'treatment',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimizer_experiments_status
  ON public.optimizer_experiments (status, created_at DESC);

ALTER TABLE public.optimizer_experiments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.optimizer_experiments IS
  'Experiment ledger for closed-loop viral optimizer (admin CRUD via edge service_role).';