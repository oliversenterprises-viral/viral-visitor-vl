-- Phase 3b: self-optimizing growth engine (measure → decide → act).
-- Extends autopilot with share-first auto-fix when share leak detected.
-- Cron unchanged: Vercel /api/cron-optimizer daily 06:00 UTC.

UPDATE public.site_content
SET
  value = COALESCE(value::jsonb, '{}'::jsonb)
    || '{"growth_engine":true,"growth_engine_version":"3b","growth_engine_status":"collecting"}'::jsonb,
  updated_at = NOW()
WHERE key = 'optimizer_flags';

INSERT INTO public.site_content (key, value, description)
SELECT
  'optimizer_flags',
  '{"auto_pilot":true,"growth_engine":true,"growth_engine_version":"3b","growth_engine_status":"collecting","visitor_slim":true,"autopilot_schedule":"0 6 * * * UTC","autopilot_via":"vercel-cron"}'::jsonb,
  'Viral Optimizer flags — growth engine + autopilot'
WHERE NOT EXISTS (SELECT 1 FROM public.site_content WHERE key = 'optimizer_flags');