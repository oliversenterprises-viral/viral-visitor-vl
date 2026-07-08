-- 0030_consolidate_site_content_policies.sql
-- One canonical public SELECT policy; revoke direct writes (admin via admin-action edge only).

DROP POLICY IF EXISTS "Admins can manage site_content" ON public.site_content;
DROP POLICY IF EXISTS "Allow content management (admin panel)" ON public.site_content;
DROP POLICY IF EXISTS "Allow public insert access" ON public.site_content;
DROP POLICY IF EXISTS "Allow public read access" ON public.site_content;
DROP POLICY IF EXISTS "Allow public update access" ON public.site_content;
DROP POLICY IF EXISTS "Public can read site content" ON public.site_content;
DROP POLICY IF EXISTS "Public can read site_content" ON public.site_content;
DROP POLICY IF EXISTS "Service role full access site_content" ON public.site_content;
DROP POLICY IF EXISTS "Service role can manage site_content" ON public.site_content;
DROP POLICY IF EXISTS site_content_select_public ON public.site_content;

CREATE POLICY site_content_select_public
  ON public.site_content
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY site_content_service_role_all
  ON public.site_content
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.site_content FROM anon, authenticated;
GRANT SELECT ON public.site_content TO anon, authenticated;

COMMENT ON TABLE public.site_content IS
  'Public CMS key-value store. Anon/authenticated: SELECT only. Writes via admin-action edge (service_role).';