-- 0028_migrate_legacy_claims_and_drop.sql
-- Finish 0004 data migration: copy any rows still in legacy public.claims → prize_claims, drop claims.

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
  c.id,
  c.created_at,
  c.referrer_code,
  c.website_url,
  c.cashapp_cashtag,
  c.message,
  c.status,
  c.paid_at,
  c.created_at,
  1
FROM public.claims c
WHERE NOT EXISTS (
  SELECT 1 FROM public.prize_claims p WHERE p.id = c.id
);

-- Drop legacy RLS policies (names vary between 0002 and manual prod policies).
DROP POLICY IF EXISTS "Admin can manage claims" ON public.claims;
DROP POLICY IF EXISTS "Anyone can submit a claim" ON public.claims;
DROP POLICY IF EXISTS "Block direct writes on claims" ON public.claims;
DROP POLICY IF EXISTS "Public can view claims" ON public.claims;
DROP POLICY IF EXISTS "Service role full access claims" ON public.claims;
DROP POLICY IF EXISTS "Only service_role can write to claims" ON public.claims;
DROP POLICY IF EXISTS "Service role can do everything on claims" ON public.claims;

DROP TABLE IF EXISTS public.claims;

COMMENT ON TABLE public.prize_claims IS
  'Prize claims (canonical). All writes via submit-claim or admin-action edge. Legacy claims table removed in 0028.';