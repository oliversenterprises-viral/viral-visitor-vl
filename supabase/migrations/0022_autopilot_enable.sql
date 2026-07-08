-- Enable Phase 3a autopilot (A/B winner promotion only — guarded by edge logic).
-- Cron: Vercel /api/cron-optimizer daily 06:00 UTC when CRON_SECRET is configured.

UPDATE public.site_content
SET
  value = COALESCE(value::jsonb, '{}'::jsonb)
    || '{"auto_pilot":true,"autopilot_schedule":"0 6 * * * UTC","autopilot_via":"vercel-cron"}'::jsonb,
  updated_at = NOW()
WHERE key = 'optimizer_flags';

INSERT INTO public.site_content (key, value, description)
SELECT
  'optimizer_flags',
  '{"auto_pilot":true,"visitor_slim":true,"autopilot_schedule":"0 6 * * * UTC","autopilot_via":"vercel-cron"}'::jsonb,
  'Viral Optimizer flags — auto_pilot promotes confirmed A/B share winners'
WHERE NOT EXISTS (SELECT 1 FROM public.site_content WHERE key = 'optimizer_flags');