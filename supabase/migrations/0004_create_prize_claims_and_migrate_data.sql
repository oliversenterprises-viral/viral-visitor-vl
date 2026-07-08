-- ============================================================================
-- MIGRATION 0004 (canonical): Create `prize_claims` table + Migrate data from `claims`
-- Alternate rename-only path archived at supabase/migrations-archive/0004_align_claims_to_prize_claims.sql
-- Strategy: Safe, reversible approach for Option 1
-- - We do NOT modify or delete the existing `claims` table.
-- - We create a new `prize_claims` table with the correct structure.
-- - We copy data from `claims` into `prize_claims`.
-- - Rollback is easy: just stop using `prize_claims` and keep using `claims`.
-- ============================================================================

-- 1. Create the new `prize_claims` table with proper structure
-- (aligned with Edge Functions + 0001 design, while supporting current UI needs)
CREATE TABLE IF NOT EXISTS public.prize_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  referrer_code text NOT NULL,
  website text,                           -- mapped from old website_url
  cashtag text,                           -- mapped from old cashapp_cashtag
  message text,
  status text DEFAULT 'pending'::text,
  paid_at timestamp with time zone,

  -- Additional columns required by Edge Functions and secure architecture
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prize_type text DEFAULT 'top_referrer_prize',
  amount numeric(12,2) DEFAULT 10.00,
  rank_at_claim integer,
  claimed_at timestamp with time zone,
  processed_at timestamp with time zone,
  review_note text,
  reviewed_at timestamp with time zone
);

-- Add primary key
ALTER TABLE public.prize_claims ADD PRIMARY KEY (id);

-- 2. Add useful indexes
CREATE INDEX IF NOT EXISTS idx_prize_claims_referrer_code ON public.prize_claims(referrer_code);
CREATE INDEX IF NOT EXISTS idx_prize_claims_status ON public.prize_claims(status);
CREATE INDEX IF NOT EXISTS idx_prize_claims_created_at ON public.prize_claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prize_claims_user_id ON public.prize_claims(user_id);

-- 3. Add status check constraint
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

-- 4. Migrate data from old `claims` table into new `prize_claims` table
-- Column mapping:
--   claims.website_url     → prize_claims.website
--   claims.cashapp_cashtag → prize_claims.cashtag
INSERT INTO public.prize_claims (
  id,
  created_at,
  referrer_code,
  website,
  cashtag,
  message,
  status,
  paid_at,
  claimed_at,
  rank_at_claim
)
SELECT 
  id,
  created_at,
  referrer_code,
  website_url,           -- mapped
  cashapp_cashtag,       -- mapped
  message,
  status,
  paid_at,
  created_at,            -- backfill claimed_at with original creation date
  1                      -- default rank (we can improve this later if needed)
FROM public.claims;

-- 5. Enable Row Level Security (we will add proper policies in 0005)
ALTER TABLE public.prize_claims ENABLE ROW LEVEL SECURITY;

-- 6. Add helpful comment
COMMENT ON TABLE public.prize_claims IS 
'Main table for prize claims. All writes should go through submit-claim or admin-action Edge Functions. Old claims table is kept as backup.';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if something goes wrong):
-- 1. Revert all code references back to the old `claims` table.
-- 2. (Optional) Drop the new table: DROP TABLE public.prize_claims;
-- ============================================================================