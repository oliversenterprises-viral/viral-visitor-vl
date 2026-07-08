-- 0032_seed_viral_loops_config.sql
-- Default toggles + weekly community goal for viral loops (Admin-editable via site_content).

INSERT INTO public.site_content (key, value, description)
SELECT
  'viral_loops_config',
  '{
    "challenge_enabled": true,
    "receipt_enabled": true,
    "anxiety_enabled": true,
    "sprint_enabled": true,
    "community_enabled": true,
    "community_goal_weekly": 100
  }'::jsonb,
  'Viral loops toggles and weekly community goal — editable in Admin without migration'
WHERE NOT EXISTS (SELECT 1 FROM public.site_content WHERE key = 'viral_loops_config');