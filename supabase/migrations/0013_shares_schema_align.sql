-- Align shares table with viral-refer flow (referrer_code, optional user_id, modern platforms)

ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS referrer_code TEXT;

ALTER TABLE public.shares ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.shares DROP CONSTRAINT IF EXISTS shares_platform_check;
ALTER TABLE public.shares ADD CONSTRAINT shares_platform_check
  CHECK (platform IN (
    'twitter', 'x', 'facebook', 'linkedin', 'whatsapp', 'email',
    'telegram', 'sms', 'copy', 'other'
  ));

CREATE INDEX IF NOT EXISTS idx_shares_referrer_code ON public.shares(referrer_code);
CREATE INDEX IF NOT EXISTS idx_shares_platform ON public.shares(platform);

COMMENT ON COLUMN public.shares.referrer_code IS 'VIRAL-XXXX code of the sharer (no auth required).';