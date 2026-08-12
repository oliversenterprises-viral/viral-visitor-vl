-- Optional ownership hash for homepage-feature claims.
-- NULL = grandfathered (old codes can still claim). New links set a hash at mint.
-- Safe to apply: additive nullable column. Not auto-applied.

ALTER TABLE public.referrer_links
  ADD COLUMN IF NOT EXISTS ownership_hash TEXT;

COMMENT ON COLUMN public.referrer_links.ownership_hash IS
  'HMAC hash of claim ownership token. NULL means legacy code (claim without token).';
