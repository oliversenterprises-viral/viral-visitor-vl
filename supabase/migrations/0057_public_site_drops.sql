-- 0057_public_site_drops.sql
-- Homepage Site Drop ladder (Just entered / Rising / Challenger).
-- One keyed row, LIMIT 1, 2s statement timeout so a hung pool cannot
-- wedge Nano compute the way a full site_content REST scan did.

CREATE OR REPLACE FUNCTION public.get_public_site_drops()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '2s'
AS $$
  SELECT COALESCE(
    (
      SELECT sc.value
      FROM public.site_content sc
      WHERE sc.key = 'site_drops'
      LIMIT 1
    ),
    '{}'::jsonb
  )::json;
$$;

REVOKE ALL ON FUNCTION public.get_public_site_drops() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_drops() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_public_site_drops() IS
  'Homepage Site Drop ladder JSON (entered / rising / challenger). LIMIT 1 + 2s statement_timeout.';
