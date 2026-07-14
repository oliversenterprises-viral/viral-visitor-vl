-- Lock-on-first-referral model: pending until a real referral credits the code.
-- Grace: longer base window + optional deadline extensions when they open a real share path.

ALTER TABLE public.referrer_links
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

ALTER TABLE public.referrer_links
  ADD COLUMN IF NOT EXISTS share_grace_count integer NOT NULL DEFAULT 0;

-- Backfill: 48h from created_at for still-pending rows without deadline
UPDATE public.referrer_links
SET deadline_at = created_at + interval '48 hours'
WHERE deadline_at IS NULL
  AND status = 'pending_share';

CREATE INDEX IF NOT EXISTS idx_referrer_links_pending_deadline
  ON public.referrer_links (deadline_at)
  WHERE status = 'pending_share';

COMMENT ON COLUMN public.referrer_links.deadline_at IS
  'When pending_share expires if no first referral yet. Extended by share-attempt grace.';
COMMENT ON COLUMN public.referrer_links.share_grace_count IS
  'How many share-attempt grace extensions applied (max 2).';
COMMENT ON TABLE public.referrer_links IS
  'Referrer codes stay pending until first verified referral credit (or expire at deadline_at).';
