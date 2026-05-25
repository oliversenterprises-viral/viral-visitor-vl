-- seed-campaign-content.sql
-- Safe, idempotent seed for the "early campaign / honest launch" positioning strings.
-- Run this in the Supabase SQL Editor (or via supabase db push / psql).
--
-- These overrides are read at runtime by the public site via fetchSiteContent + updatePublicContent.
-- They will instantly replace stale cached HTML text for any keys that the currently-deployed
-- JS bundle knows how to apply (leaderboard_title, recent_activity_description, etc.).
--
-- After the next `git push` (which ships the new ids for hero-campaign-badge, hero-stats-subtext,
-- footer-credit), these same keys will also control the newly wired elements.
--
-- Values are stored as JSONB strings (matching the table schema and existing seeds).
-- The public site does String(value) for display, so plain text strings work.
--
-- Usage:
--   1. Copy the entire BEGIN ... COMMIT block into Supabase SQL Editor → Run.
--   2. Hard-refresh viralrefer.app (or wait for any in-flight cache).
--   3. The listed texts the user wanted ("Be one of the first...", "Early Leaderboard", badge,
--      footer credit, warmer recent activity) will appear where the current bundle supports them.
--
-- To undo / preview first, run only the SELECT at the bottom.

BEGIN;

-- Core campaign positioning (directly address the user's reported stale texts)
INSERT INTO public.site_content (key, value, description) VALUES
  ('leaderboard_title', '"Early Leaderboard"'::jsonb, 'Public leaderboard heading (warm early-campaign tone)'),
  ('leaderboard_description', '"Campaign just launched • Be the first to qualify"'::jsonb, 'Subtitle under leaderboard'),
  ('recent_activity_description', '"Early activity from the first participants"'::jsonb, 'Label above the live recent activity feed'),
  ('hero_campaign_badge', '"Campaign just launched"'::jsonb, 'Small hero badge for honest launch positioning'),
  ('hero_stats_subtext', '"Be one of the first to refer"'::jsonb, 'Hero stats line (replaces the old "Join 0 people..." copy)'),
  ('footer_credit', '"Created by Karanga Oliver"'::jsonb, 'Footer attribution (the credit the user wants visible)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Also ensure a couple of high-visibility supporting strings stay warm / consistent
INSERT INTO public.site_content (key, value, description) VALUES
  ('stats_title', '"Your Stats"'::jsonb, 'Section heading'),
  ('recent_activity_title', '"Recent Activity"'::jsonb, 'Section heading')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Optional: keep the total-referrers dynamic if you ever want to override the live count display elsewhere
-- (the hero "X people" number is populated client-side via fetchTotalReferrers and is not a site_content key)

COMMIT;

-- Quick verification: run this SELECT to see the values that will be served to the public site
SELECT key, value, updated_at, description
FROM public.site_content
WHERE key IN (
  'leaderboard_title',
  'leaderboard_description',
  'recent_activity_description',
  'hero_campaign_badge',
  'hero_stats_subtext',
  'footer_credit',
  'stats_title',
  'recent_activity_title'
)
ORDER BY key;
