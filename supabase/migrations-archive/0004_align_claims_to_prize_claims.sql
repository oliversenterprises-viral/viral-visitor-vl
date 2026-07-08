-- ARCHIVED — not applied in production.
-- Prod uses 0004_create_prize_claims_and_migrate_data.sql (both claims + prize_claims exist).
-- Kept for reference only; do not move back into supabase/migrations/.

-- ============================================================================
-- MIGRATION 0004: Align existing `claims` table to `prize_claims`
-- Purpose: Standardize on `prize_claims` (as used by Edge Functions + 0001)
--          while preserving all existing production data.
--
-- IMPORTANT: Run this ONLY on a STAGING/COPY of your production database first.
--            Take a backup before running on production.
-- ============================================================================

-- 1. Rename the table from claims → prize_claims
ALTER TABLE IF EXISTS public.claims RENAME TO prize_claims;

-- 2. Rename columns for consistency with Edge Functions and 0001 design
ALTER TABLE public.prize_claims RENAME COLUMN website_url TO website;
ALTER TABLE public.prize_claims RENAME COLUMN cashapp_cashtag TO cashtag;

-- 3. Add missing columns required by the secure architecture (0001 + Edge Functions)
ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS prize_type TEXT DEFAULT 'top_referrer_prize';

ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 10.00;

ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS rank_at_claim INTEGER;

ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE public.prize_claims 
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 4. Backfill some useful values from existing data
UPDATE public.prize_claims
SET 
  claimed_at = created_at,
  rank_at_claim = 1
WHERE claimed_at IS NULL;

-- 5. Add useful indexes (from 0001 design)
CREATE INDEX IF NOT EXISTS idx_prize_claims_referrer_code ON public.prize_claims(referrer_code);
CREATE INDEX IF NOT EXISTS idx_prize_claims_status ON public.prize_claims(status);
CREATE INDEX IF NOT EXISTS idx_prize_claims_created_at ON public.prize_claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prize_claims_user_id ON public.prize_claims(user_id);

-- 6. Add a basic CHECK constraint on status (can be tightened later)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'prize_claims_status_check'
  ) THEN
    ALTER TABLE public.prize_claims
    ADD CONSTRAINT prize_claims_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid'));
  END IF;
END $$;

-- 7. Enable RLS (we will add proper policies in 0005)
ALTER TABLE public.prize_claims ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.prize_claims IS 'Prize claims submitted by top referrers. All writes must go through submit-claim or admin-action Edge Functions.';