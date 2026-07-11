-- 24h verified-share activation window for referrer links.
-- Codes register on get-link (pending_share). A real share (not clipboard-only)
-- activates them. Pending codes older than 24h expire and stop earning referrals.

CREATE TABLE IF NOT EXISTS public.referrer_links (
  referrer_code text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_verified_share_at timestamptz,
  first_share_platform text,
  status text NOT NULL DEFAULT 'pending_share'
    CHECK (status IN ('pending_share', 'active', 'expired')),
  expired_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_referrer_links_pending_created
  ON public.referrer_links (created_at)
  WHERE status = 'pending_share';

CREATE INDEX IF NOT EXISTS idx_referrer_links_status
  ON public.referrer_links (status);

ALTER TABLE public.referrer_links ENABLE ROW LEVEL SECURITY;

-- No public policies: only service_role (edge functions) can read/write.
-- (RLS with no policies blocks anon/authenticated; service_role bypasses RLS.)

COMMENT ON TABLE public.referrer_links IS
  'Referrer codes must record a verified share within 24h of registration or become expired.';
