-- 0033_tune_community_goal.sql
-- Lower weekly community unlock goal.
-- Preview replay: 0001 site_content.value is JSONB. Prod drifted to TEXT JSON.

DO $$
DECLARE
  val_type text;
  next_val text;
BEGIN
  SELECT data_type INTO val_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'site_content'
    AND column_name = 'value';

  SELECT replace(
           replace(value::text, '"community_goal_weekly":100', '"community_goal_weekly":25'),
           '"community_goal_weekly": 100',
           '"community_goal_weekly": 25'
         )
    INTO next_val
  FROM public.site_content
  WHERE key = 'viral_loops_config';

  IF next_val IS NULL THEN
    RETURN;
  END IF;

  IF val_type = 'jsonb' THEN
    UPDATE public.site_content
    SET value = next_val::jsonb, updated_at = NOW()
    WHERE key = 'viral_loops_config';
  ELSE
    UPDATE public.site_content
    SET value = next_val, updated_at = NOW()
    WHERE key = 'viral_loops_config';
  END IF;
END $$;