-- Idempotent polish migrations (0005-0007) safe for existing prod schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0005 RPCs
CREATE OR REPLACE FUNCTION public.get_leaderboard(min_referrals int DEFAULT 1)
RETURNS TABLE (referrer_code TEXT, referral_count INTEGER, rank INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.referrer_code, p.referral_count,
    ROW_NUMBER() OVER (ORDER BY p.referral_count DESC, p.created_at ASC)::INTEGER AS rank
  FROM public.profiles p
  WHERE p.referral_count >= COALESCE(min_referrals, 1)
  ORDER BY p.referral_count DESC, p.created_at ASC
  LIMIT 50;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_total_referral_count()
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(referral_count), 0)::INTEGER FROM public.profiles;
$$;
GRANT EXECUTE ON FUNCTION public.get_total_referral_count() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_referral_count(p_referrer_code TEXT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT referral_count FROM public.profiles WHERE referrer_code = p_referrer_code), 0);
$$;
GRANT EXECUTE ON FUNCTION public.get_my_referral_count(TEXT) TO anon, authenticated;

-- 0006 banner_events
CREATE TABLE IF NOT EXISTS public.banner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('impression', 'click')),
  label TEXT,
  redirect_url TEXT,
  key TEXT,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_banner_events_key_created ON public.banner_events (key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_banner_events_created ON public.banner_events (created_at DESC);
ALTER TABLE public.banner_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'banner_events' AND policyname = 'Allow public insert for banner events (via Edge)'
  ) THEN
    CREATE POLICY "Allow public insert for banner events (via Edge)"
      ON public.banner_events FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;
GRANT INSERT ON public.banner_events TO anon, authenticated;

-- 0007 site_content key align
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS key TEXT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_content' AND column_name = 'id') THEN
    UPDATE public.site_content SET key = id::text WHERE key IS NULL AND id IS NOT NULL;
  END IF;
END $$;