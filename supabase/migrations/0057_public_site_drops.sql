-- 0057_public_site_drops.sql
-- Homepage Site Drop ladder (Just entered / Rising Site Drops / Challenger strip).
-- One keyed row, LIMIT 1, 2s statement timeout so a hung pool cannot
-- wedge first paint the way a full site_content REST scan did.
-- value may be TEXT JSON (prod drift) or JSONB — always cast via text.

CREATE OR REPLACE FUNCTION public.get_public_site_drops()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '2s'
AS $$
DECLARE
  raw text;
  parsed json;
BEGIN
  SELECT sc.value::text
    INTO raw
    FROM public.site_content sc
    WHERE sc.key = 'site_drops'
    LIMIT 1;

  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '{}'::json;
  END IF;

  BEGIN
    parsed := raw::json;
  EXCEPTION WHEN others THEN
    RETURN '{}'::json;
  END;

  RETURN parsed;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_site_drops() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_drops() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_public_site_drops() IS
  'Homepage Site Drop ladder JSON (entered / rising / challenger). LIMIT 1 + 2s statement_timeout.';
