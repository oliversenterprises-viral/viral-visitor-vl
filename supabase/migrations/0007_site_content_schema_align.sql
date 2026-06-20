-- ============================================================================
-- supabase/migrations/0007_site_content_schema_align.sql
-- Align prod site_content table with 0001_init_rls.sql definition (key TEXT PRIMARY KEY).
-- Prod had drift causing "column site_content.key does not exist" (see prior screenshot/error).
-- This ensures 'key' column exists, backfills from 'id' if present (for data migration), 
-- and sets as PK if needed. Idempotent/safe.
-- Run after 0001-0006. Then code can use strict 'key' queries.
-- ============================================================================

-- Add 'key' column if missing (for drifted prod tables that may use 'id' as identifier).
ALTER TABLE public.site_content 
ADD COLUMN IF NOT EXISTS key TEXT;

-- Backfill 'key' from 'id' if 'id' exists and 'key' is null (handles id-vs-key drift from audits).
-- This preserves existing data (e.g., 'banners', 'hero_*' rows).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_content' AND column_name = 'id'
  ) THEN
    UPDATE public.site_content 
    SET key = id::text 
    WHERE key IS NULL AND id IS NOT NULL;
  END IF;
END $$;

-- If no PK or PK is on 'id', adjust to 'key' (safe if 'key' now unique).
-- Note: 0001 defines key as PK. This makes it so if drifted.
ALTER TABLE public.site_content 
DROP CONSTRAINT IF EXISTS site_content_pkey;  -- if existed on id

-- Ensure unique on key (as PK in migration).
ALTER TABLE public.site_content 
ADD CONSTRAINT IF NOT EXISTS site_content_key_unique UNIQUE (key);

-- Set key as PK if not already (for full alignment).
-- (Postgres allows one PK; this assumes after backfill.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.site_content'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.site_content 
    ADD PRIMARY KEY (key);
  END IF;
END $$;

-- Update index if needed (already in 0001 for updated_at).
-- Add comment for clarity.
COMMENT ON COLUMN public.site_content.key IS 'Primary identifier for content (matches 0001 migration; logical key like "banners", "hero_title").';

-- Verify command (run separately): SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'site_content' ORDER BY ordinal_position;

-- Rollback (if needed): ALTER TABLE public.site_content DROP COLUMN IF EXISTS key; (but loses data if backfilled).

-- After apply: supabase db push or SQL editor.
-- Then update client code to strict .select('key, value').order('key') (tolerant was workaround).
-- Test: Admin Edit Content loads without error; public fetchSiteContent works; Edge updates use 'key'.

-- Coordinate with 0006 (banner events) -- site_content 'banners' key should now be consistent.