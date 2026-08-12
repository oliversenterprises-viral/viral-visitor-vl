-- Lifetime one credit per (referrer_code, referred_ip).
-- DO NOT APPLY until duplicates are reviewed:
--   SELECT referrer_code, referred_ip, COUNT(*)
--   FROM public.referrals
--   WHERE referred_ip IS NOT NULL
--   GROUP BY 1, 2
--   HAVING COUNT(*) > 1;
-- If that query returns rows, keep the earliest and delete extras first.
-- This file is not auto-applied. Use npm run dba:apply-migration only after the check.

CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_per_ip_per_code
  ON public.referrals (referrer_code, referred_ip)
  WHERE referred_ip IS NOT NULL;
