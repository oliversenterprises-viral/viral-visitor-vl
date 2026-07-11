-- Public "people got a link today" stat for the homepage (additive; does not change referral totals).
-- Uses index-friendly filter on visitor_events (event_name, created_at).

CREATE OR REPLACE FUNCTION public.get_public_get_link_stats(p_hours int DEFAULT 24)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT GREATEST(LEAST(COALESCE(p_hours, 24), 168), 1) AS hours
  ),
  windowed AS (
    SELECT visitor_id, id
    FROM public.visitor_events
    WHERE event_name = 'GetReferralLink'
      AND created_at >= (NOW() - ((SELECT hours FROM bounds) * INTERVAL '1 hour'))
  )
  SELECT json_build_object(
    'window_hours', (SELECT hours FROM bounds),
    'events', (SELECT COUNT(*)::INTEGER FROM windowed),
    'unique_people', (
      SELECT COUNT(DISTINCT visitor_id)::INTEGER
      FROM windowed
      WHERE visitor_id IS NOT NULL AND btrim(visitor_id) <> ''
    )
  );
$$;

COMMENT ON FUNCTION public.get_public_get_link_stats(int) IS
  'Public homepage: how many people tapped Get referral link in the last N hours (unique visitor_id).';

GRANT EXECUTE ON FUNCTION public.get_public_get_link_stats(int) TO anon, authenticated;
