-- 0027_lock_down_optimizer_tables.sql
-- interaction_events + optimizer_experiments: edge/service_role only (no direct anon/authenticated access).
-- Client writes via record-interaction edge; admin reads via admin-action edge.

DROP POLICY IF EXISTS "Allow public insert for interaction events (via Edge)"
  ON public.interaction_events;

REVOKE ALL ON public.interaction_events FROM anon, authenticated;
REVOKE ALL ON public.optimizer_experiments FROM anon, authenticated;

COMMENT ON TABLE public.interaction_events IS
  'Viral zone clicks and scroll depth. Writes: record-interaction edge (service_role). Reads: admin-action edge only.';

COMMENT ON TABLE public.optimizer_experiments IS
  'Experiment ledger for closed-loop viral optimizer. All access via admin-action edge (service_role).';