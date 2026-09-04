-- Platform guard: disk / load / Edge-run counters for ViralRefer.
-- Public reads flags only. Refresh + bump are service_role.
-- Never deletes referrals, shares, or referrer_links.

CREATE TABLE IF NOT EXISTS public.platform_guard_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  disk_bytes bigint NOT NULL DEFAULT 0,
  disk_limit_bytes bigint NOT NULL DEFAULT 524288000,
  visitor_event_rows bigint NOT NULL DEFAULT 0,
  interaction_event_rows bigint NOT NULL DEFAULT 0,
  edge_invokes_month bigint NOT NULL DEFAULT 0,
  edge_month text NOT NULL DEFAULT '',
  edge_limit bigint NOT NULL DEFAULT 500000,
  db_activity int NOT NULL DEFAULT 0,
  drop_noise boolean NOT NULL DEFAULT false,
  skip_realtime boolean NOT NULL DEFAULT false,
  last_prune_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_guard_state (id, edge_month)
VALUES (1, to_char(timezone('utc', now()), 'YYYY-MM'))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_guard_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_guard_state FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.bump_platform_guard_invoke()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_key text := to_char(timezone('utc', now()), 'YYYY-MM');
BEGIN
  INSERT INTO public.platform_guard_state (id, edge_month, edge_invokes_month)
  VALUES (1, month_key, 1)
  ON CONFLICT (id) DO UPDATE SET
    edge_invokes_month = CASE
      WHEN public.platform_guard_state.edge_month = month_key
        THEN public.platform_guard_state.edge_invokes_month + 1
      ELSE 1
    END,
    edge_month = month_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_platform_guard_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  disk bigint;
  lim bigint := 524288000;
  ve bigint := 0;
  ie bigint := 0;
  act int := 0;
  month_key text;
  invokes bigint := 0;
  drop_n boolean;
  skip_rt boolean;
  pruned int := 0;
  extra int := 0;
BEGIN
  disk := pg_database_size(current_database());
  SELECT COALESCE(n_live_tup, 0) INTO ve
    FROM pg_stat_user_tables WHERE relname = 'visitor_events';
  SELECT COALESCE(n_live_tup, 0) INTO ie
    FROM pg_stat_user_tables WHERE relname = 'interaction_events';
  SELECT count(*)::int INTO act
    FROM pg_stat_activity WHERE datname = current_database();
  month_key := to_char(timezone('utc', now()), 'YYYY-MM');

  INSERT INTO public.platform_guard_state (id, edge_month, edge_invokes_month)
  VALUES (1, month_key, 0)
  ON CONFLICT (id) DO UPDATE SET
    edge_invokes_month = CASE
      WHEN public.platform_guard_state.edge_month = month_key
        THEN public.platform_guard_state.edge_invokes_month
      ELSE 0
    END,
    edge_month = month_key;

  SELECT edge_invokes_month INTO invokes FROM public.platform_guard_state WHERE id = 1;

  -- Always drop click rows older than 30 days (not credits).
  DELETE FROM public.interaction_events
  WHERE created_at < timezone('utc', now()) - interval '30 days';
  GET DIAGNOSTICS pruned = ROW_COUNT;

  IF disk::numeric / lim >= 0.70 THEN
    DELETE FROM public.interaction_events
    WHERE created_at < timezone('utc', now()) - interval '7 days';
    GET DIAGNOSTICS extra = ROW_COUNT;
    pruned := pruned + extra;
  END IF;

  drop_n := (disk::numeric / lim) >= 0.70
    OR (invokes::numeric / 500000.0) >= 0.70
    OR act >= 40;
  skip_rt := act >= 30 OR (disk::numeric / lim) >= 0.80 OR drop_n;

  UPDATE public.platform_guard_state SET
    disk_bytes = disk,
    disk_limit_bytes = lim,
    visitor_event_rows = ve,
    interaction_event_rows = ie,
    db_activity = act,
    drop_noise = drop_n,
    skip_realtime = skip_rt,
    last_prune_at = CASE WHEN pruned > 0 THEN timezone('utc', now()) ELSE last_prune_at END,
    updated_at = timezone('utc', now())
  WHERE id = 1;

  RETURN jsonb_build_object(
    'diskBytes', disk,
    'diskLimitBytes', lim,
    'visitorEventRows', ve,
    'interactionEventRows', ie,
    'edgeInvokesMonth', invokes,
    'edgeLimit', 500000,
    'dbActivity', act,
    'dropNoise', drop_n,
    'skipRealtime', skip_rt,
    'prunedInteractions', pruned,
    'updatedAt', timezone('utc', now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_guard_public()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'dropNoise', COALESCE(drop_noise, false),
    'skipRealtime', COALESCE(skip_realtime, false),
    'diskBytes', COALESCE(disk_bytes, 0),
    'diskLimitBytes', COALESCE(disk_limit_bytes, 524288000),
    'visitorEventRows', COALESCE(visitor_event_rows, 0),
    'interactionEventRows', COALESCE(interaction_event_rows, 0),
    'edgeInvokesMonth', COALESCE(edge_invokes_month, 0),
    'edgeLimit', COALESCE(edge_limit, 500000),
    'dbActivity', COALESCE(db_activity, 0),
    'updatedAt', updated_at
  )
  FROM public.platform_guard_state
  WHERE id = 1
  UNION ALL
  SELECT jsonb_build_object(
    'dropNoise', false,
    'skipRealtime', false,
    'diskBytes', 0,
    'diskLimitBytes', 524288000,
    'visitorEventRows', 0,
    'interactionEventRows', 0,
    'edgeInvokesMonth', 0,
    'edgeLimit', 500000,
    'dbActivity', 0
  )
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_guard_state WHERE id = 1)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.bump_platform_guard_invoke() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_platform_guard_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_platform_guard_public() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.bump_platform_guard_invoke() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_platform_guard_state() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_guard_public() TO anon, authenticated, service_role;

COMMENT ON TABLE public.platform_guard_state IS
  'One-row platform guard. Public RPC returns flags only. Refresh/bump are service_role.';
