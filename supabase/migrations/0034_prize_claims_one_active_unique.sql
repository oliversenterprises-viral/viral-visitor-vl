-- One active prize claim per referrer_code (pending/approved/paid).
-- Prevents TOCTOU double-submit races; submit-claim handles 23505 → 409.
-- Additive and production-safe: fails only if duplicates already exist.

-- If duplicates exist, keep the earliest row active and reject the rest for ops review.
-- (No automatic delete — surface via unique index creation failure if any.)

CREATE UNIQUE INDEX IF NOT EXISTS prize_claims_one_active_per_code
  ON public.prize_claims (referrer_code)
  WHERE status IN ('pending', 'approved', 'paid');
