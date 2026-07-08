-- 0033_tune_community_goal.sql
-- Lower weekly community unlock goal (site_content.value is TEXT JSON in prod).

UPDATE public.site_content
SET
  value = replace(
    replace(value::text, '"community_goal_weekly":100', '"community_goal_weekly":25'),
    '"community_goal_weekly": 100',
    '"community_goal_weekly": 25'
  ),
  updated_at = NOW()
WHERE key = 'viral_loops_config';