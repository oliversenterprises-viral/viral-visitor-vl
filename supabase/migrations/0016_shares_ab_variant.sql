-- Wave 6: track A/B message variant at share time for Share Analytics
ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS ab_variant TEXT;

ALTER TABLE public.shares DROP CONSTRAINT IF EXISTS shares_ab_variant_check;
ALTER TABLE public.shares ADD CONSTRAINT shares_ab_variant_check
  CHECK (ab_variant IS NULL OR ab_variant IN ('a', 'b'));

COMMENT ON COLUMN public.shares.ab_variant IS 'A/B message variant (a|b) active when user shared.';