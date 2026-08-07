-- ============================================================================
-- 0044_viralrefer_relay.sql
-- ViralRefer Relay — reciprocal traffic exchange (Hot Seat + credits).
-- Writes only via service_role / Edge Functions. Public read via SECURITY DEFINER RPC.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.relay_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_dwell_seconds INTEGER NOT NULL DEFAULT 15 CHECK (min_dwell_seconds BETWEEN 5 AND 120),
  views_per_seat INTEGER NOT NULL DEFAULT 5 CHECK (views_per_seat BETWEEN 1 AND 50),
  house_url TEXT NOT NULL DEFAULT 'https://www.viralrefer.app/?ref=RELAY&utm_source=relay&utm_medium=hotseat&utm_campaign=house',
  house_label TEXT NOT NULL DEFAULT 'ViralRefer — free referral leaderboard',
  banner_url TEXT NOT NULL DEFAULT 'https://www.viralrefer.app/?ref=RELAY&utm_source=relay&utm_medium=banner&utm_campaign=house',
  enqueue_cooldown_seconds INTEGER NOT NULL DEFAULT 120 CHECK (enqueue_cooldown_seconds BETWEEN 0 AND 86400),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.relay_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.relay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  ip_hash TEXT,
  user_agent TEXT,
  referral_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relay_sessions_last_seen_idx ON public.relay_sessions (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.relay_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  submitter_session_id UUID REFERENCES public.relay_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'live', 'completed', 'rejected')),
  queue_position BIGINT,
  views_remaining INTEGER NOT NULL DEFAULT 0 CHECK (views_remaining >= 0),
  views_delivered INTEGER NOT NULL DEFAULT 0 CHECK (views_delivered >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  live_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS relay_links_status_created_idx
  ON public.relay_links (status, created_at ASC);
CREATE INDEX IF NOT EXISTS relay_links_domain_created_idx
  ON public.relay_links (domain, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS relay_links_one_live_idx
  ON public.relay_links (status)
  WHERE status = 'live';

CREATE TABLE IF NOT EXISTS public.relay_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.relay_sessions(id) ON DELETE CASCADE,
  target_link_id UUID REFERENCES public.relay_links(id) ON DELETE SET NULL,
  is_house BOOLEAN NOT NULL DEFAULT false,
  dwell_ms INTEGER NOT NULL DEFAULT 0,
  focused BOOLEAN NOT NULL DEFAULT false,
  credited BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relay_views_session_created_idx
  ON public.relay_views (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS relay_views_created_idx
  ON public.relay_views (created_at DESC);

ALTER TABLE public.relay_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relay_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relay_views ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated direct access — Edge Functions use service_role.
DROP POLICY IF EXISTS relay_config_no_public ON public.relay_config;
DROP POLICY IF EXISTS relay_sessions_no_public ON public.relay_sessions;
DROP POLICY IF EXISTS relay_links_no_public ON public.relay_links;
DROP POLICY IF EXISTS relay_views_no_public ON public.relay_views;

-- Intentionally no GRANT SELECT/INSERT to anon on base tables.

CREATE OR REPLACE FUNCTION public.get_relay_public_state()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.relay_config%ROWTYPE;
  live_row public.relay_links%ROWTYPE;
  queued_count INTEGER;
  recent JSON;
BEGIN
  SELECT * INTO cfg FROM public.relay_config WHERE id = 1;
  IF NOT FOUND THEN
    RETURN json_build_object(
      'enabled', false,
      'error', 'not_configured'
    );
  END IF;

  IF NOT cfg.enabled THEN
    RETURN json_build_object(
      'enabled', false,
      'min_dwell_seconds', cfg.min_dwell_seconds,
      'views_per_seat', cfg.views_per_seat,
      'house_url', cfg.house_url,
      'house_label', cfg.house_label,
      'banner_url', cfg.banner_url,
      'live', NULL,
      'queue_length', 0,
      'recent', '[]'::json
    );
  END IF;

  SELECT * INTO live_row
  FROM public.relay_links
  WHERE status = 'live'
  ORDER BY live_at ASC NULLS LAST
  LIMIT 1;

  SELECT COUNT(*)::INTEGER INTO queued_count
  FROM public.relay_links
  WHERE status = 'queued';

  SELECT COALESCE(json_agg(x ORDER BY x.created_at DESC), '[]'::json)
  INTO recent
  FROM (
    SELECT
      l.domain,
      l.status,
      l.created_at,
      l.views_delivered
    FROM public.relay_links l
    WHERE l.status IN ('live', 'completed', 'queued')
    ORDER BY l.created_at DESC
    LIMIT 12
  ) x;

  IF live_row.id IS NOT NULL THEN
    RETURN json_build_object(
      'enabled', true,
      'min_dwell_seconds', cfg.min_dwell_seconds,
      'views_per_seat', cfg.views_per_seat,
      'house_url', cfg.house_url,
      'house_label', cfg.house_label,
      'banner_url', cfg.banner_url,
      'live', json_build_object(
        'id', live_row.id,
        'url', live_row.url,
        'domain', live_row.domain,
        'views_remaining', live_row.views_remaining,
        'views_delivered', live_row.views_delivered,
        'is_house', false
      ),
      'queue_length', queued_count,
      'recent', recent
    );
  END IF;

  -- Empty seat → house ViralRefer
  RETURN json_build_object(
    'enabled', true,
    'min_dwell_seconds', cfg.min_dwell_seconds,
    'views_per_seat', cfg.views_per_seat,
    'house_url', cfg.house_url,
    'house_label', cfg.house_label,
    'banner_url', cfg.banner_url,
    'live', json_build_object(
      'id', NULL,
      'url', cfg.house_url,
      'domain', 'viralrefer.app',
      'views_remaining', NULL,
      'views_delivered', 0,
      'is_house', true,
      'label', cfg.house_label
    ),
    'queue_length', queued_count,
    'recent', recent
  );
END;
$$;

COMMENT ON FUNCTION public.get_relay_public_state() IS
  'Public Hot Seat + queue length for ViralRefer Relay (no PII).';

GRANT EXECUTE ON FUNCTION public.get_relay_public_state() TO anon, authenticated;
