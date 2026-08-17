-- One active prize claim per referrer_code (pending/approved/paid).
-- Prevents TOCTOU double-submit races; submit-claim handles 23505 → 409.
-- Additive and production-safe: fails only if duplicates already exist.
-- Preview replay: 0001 prize_claims has no leftover referrer_code. Skip the index.

DO $$
BEGIN
  IF to_regclass('public.prize_claims') IS NULL THEN
    RAISE NOTICE 'skip prize_claims_one_active_per_code — prize_claims not present';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prize_claims'
      AND column_name = 'referrer_code'
  ) THEN
    RAISE NOTICE 'skip prize_claims_one_active_per_code — leftover prize_claims.referrer_code not present';
    RETURN;
  END IF;

  -- If duplicates exist, keep the earliest row active and reject the rest for ops review.
  -- (No automatic delete — surface via unique index creation failure if any.)
  EXECUTE $idx$
    CREATE UNIQUE INDEX IF NOT EXISTS prize_claims_one_active_per_code
      ON public.prize_claims (referrer_code)
      WHERE status IN ('pending', 'approved', 'paid')
  $idx$;
END $$;
