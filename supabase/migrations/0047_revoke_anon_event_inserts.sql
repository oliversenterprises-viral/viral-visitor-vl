-- Writes to visitor_events / banner_events go through Edge + service_role only.
-- Client already uses record-visitor-event / record-banner-event.
-- DO NOT APPLY until those edge functions are deployed on the same SHA.
-- Not auto-applied.

DROP POLICY IF EXISTS "Allow public insert for visitor events (via Edge)" ON public.visitor_events;
DROP POLICY IF EXISTS "Allow public insert for banner events (via Edge)" ON public.banner_events;

REVOKE INSERT ON public.visitor_events FROM anon, authenticated;
REVOKE INSERT ON public.banner_events FROM anon, authenticated;
