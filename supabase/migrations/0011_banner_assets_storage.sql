-- ============================================================================
-- 0011_banner_assets_storage.sql
-- Public-read storage bucket for admin-uploaded banner images.
-- Writes go through admin-action Edge Function (service role); anon cannot upload.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banner-assets',
  'banner-assets',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read so banner images load on the homepage prize card
DROP POLICY IF EXISTS "Public read banner assets" ON storage.objects;
CREATE POLICY "Public read banner assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'banner-assets');

