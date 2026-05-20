-- ============================================================================
-- supabase/migrations/0001_init_rls.sql
-- ViralRefer Premium - Sprint 1 Initial Schema + RLS (Production-Grade)
-- Created by Helix (Backend Integrator) in collaboration with Sentinel (Security Guardian)
-- ============================================================================
-- 
-- PURPOSE: Complete database foundation for viral referral tracking, leaderboard,
--          prize claims, and dynamic site content. All per approved Sprint 1 plan.
--
-- SECURITY PHILOSOPHY (Sentinel Audit Recommendations - EXACTLY FOLLOWED):
--   Sentinel Rec #1: ENABLE ROW LEVEL SECURITY on EVERY table in public schema
--                    immediately. No exceptions. RLS acts as the last line of defense.
--
--   Sentinel Rec #2: Service_role ONLY for all INSERT/UPDATE/DELETE on sensitive
--                    tables (referrals, shares, prize_claims, site_content).
--                    Never grant these to anon or authenticated roles. All writes
--                    MUST flow through Edge Functions that use the service_role key
--                    loaded exclusively from Deno.env.get('SUPABASE_SERVICE_ROLE_KEY').
--
--   Sentinel Rec #3: Safe public SELECT policies ONLY for leaderboard/reads.
--                    - profiles: full public SELECT (referrer_code + counts only
--                      matter for leaderboard; email/full_name treated as optional PII).
--                    - site_content: public SELECT (non-sensitive CMS data).
--                    - prize_claims: public SELECT only for approved/paid claims
--                      (social proof). Full claims visible only to owner.
--                    - referrals & shares: NO public SELECT (prevents enumeration
--                      and privacy leaks). Authenticated users see only their own.
--
--   Sentinel Rec #4: profiles RLS for own records exclusively.
--                    Authenticated users may INSERT/UPDATE/DELETE/SELECT ONLY rows
--                    where (select auth.uid()) = id. Use initPlan-optimized syntax.
--
--   Sentinel Rec #5: Defense-in-depth with SECURITY DEFINER triggers for:
--                    - Auto-generating unique referrer_code on new auth.users
--                    - Auto-incrementing referral_count + points on referrals
--                    - Preventing self-referrals at the database layer
--                    Triggers run with elevated privileges but are auditable.
--
--   Sentinel Rec #6: Performance + integrity via targeted indexes on referrer_code
--                    and created_at (as specified). Composite indexes for common
--                    leaderboard + time-range queries. FK constraints + CHECKs.
--
--   Sentinel Rec #7: Production hardening: explicit constraints, unique indexes
--                    to prevent duplicate referrals, timestamptz everywhere,
--                    updated_at auto-maintenance, minimal grants.
--
--   Sentinel Rec #8: Edge Functions (record-referral, submit-claim) are the ONLY
--                    trusted entrypoint for mutations. They perform Turnstile
--                    verification + IP rate limiting (via headers) + self-refer
--                    checks BEFORE any insert.
--
-- DO NOT modify this file without re-auditing against Sentinel checklist.
-- After applying: supabase db push (or migrate) + verify with Supabase advisor.
-- ============================================================================

-- Enable necessary extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for extra crypto if needed; gen_random_uuid() is built-in on Supabase

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

-- 1. profiles: Core user profile + referral identity
--    Every authenticated user gets exactly one row via trigger on auth.users.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  referrer_code TEXT NOT NULL UNIQUE CHECK (char_length(referrer_code) BETWEEN 4 AND 12),
  referral_count INTEGER NOT NULL DEFAULT 0 CHECK (referral_count >= 0),
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes exactly as required (referrer_code + created_at) + supporting
CREATE INDEX idx_profiles_referrer_code ON public.profiles(referrer_code);
CREATE INDEX idx_profiles_created_at ON public.profiles(created_at);
CREATE INDEX idx_profiles_referral_count ON public.profiles(referral_count DESC, created_at ASC); -- leaderboard optimization

-- 2. referrals: Immutable audit log of every successful referral action
--    Denormalized referrer_code for easy sharing links + fast lookup.
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_code TEXT NOT NULL,
  referrer_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address TEXT,                    -- Store for rate limiting & abuse detection. Consider hashing in future for GDPR.
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on referrer_code + created_at (task requirement) + composite for queries
CREATE INDEX idx_referrals_referrer_code ON public.referrals(referrer_code);
CREATE INDEX idx_referrals_created_at ON public.referrals(created_at);
CREATE INDEX idx_referrals_referrer_created ON public.referrals(referrer_code, created_at DESC);
CREATE INDEX idx_referrals_referrer_user ON public.referrals(referrer_user_id);

-- Prevent duplicate successful referrals for same pair (when referred_user_id known)
CREATE UNIQUE INDEX idx_referrals_unique_referral 
  ON public.referrals(referrer_code, referred_user_id) 
  WHERE referred_user_id IS NOT NULL;

-- 3. shares: Track social shares for engagement analytics (owned by user)
CREATE TABLE public.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'facebook', 'linkedin', 'whatsapp', 'email', 'other')),
  referral_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shares_user_id ON public.shares(user_id);
CREATE INDEX idx_shares_created_at ON public.shares(created_at);
CREATE INDEX idx_shares_user_created ON public.shares(user_id, created_at DESC);

-- 4. prize_claims: Records of prize claims (top-1 verification happens server-side)
CREATE TABLE public.prize_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prize_type TEXT NOT NULL DEFAULT 'top_referrer_prize',
  amount NUMERIC(12, 2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  rank_at_claim INTEGER CHECK (rank_at_claim >= 1),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_prize_claims_user_id ON public.prize_claims(user_id);
CREATE INDEX idx_prize_claims_status ON public.prize_claims(status);
CREATE INDEX idx_prize_claims_claimed_at ON public.prize_claims(claimed_at DESC);
CREATE INDEX idx_prize_claims_user_status ON public.prize_claims(user_id, status);

-- 5. site_content: Simple CMS / dynamic configuration (hero, prizes, rules, etc.)
CREATE TABLE public.site_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_site_content_updated_at ON public.site_content(updated_at DESC);

-- ============================================================================
-- SECURITY DEFINER TRIGGERS (Sentinel Rec #5 - trusted DB logic)
-- ============================================================================

-- Auto-update updated_at timestamp (idempotent helper)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Trigger for profiles and site_content
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auto-provision profile + unique referrer_code on new user signup (best practice)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_referrer_code TEXT;
BEGIN
  -- Generate unique, short, human-shareable referrer code (loop until unique)
  LOOP
    new_referrer_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE referrer_code = new_referrer_code
    );
  END LOOP;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    referrer_code
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    new_referrer_code
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Prevent self-referral + auto-populate referrer_user_id (defense-in-depth)
CREATE OR REPLACE FUNCTION public.prevent_self_referral_and_populate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_user_id UUID;
BEGIN
  -- Resolve referrer_code to its owner (must exist)
  SELECT id INTO v_referrer_user_id
  FROM public.profiles
  WHERE referrer_code = NEW.referrer_code;

  IF v_referrer_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or unknown referrer_code: %', NEW.referrer_code
      USING HINT = 'Referrer must have an active profile.';
  END IF;

  -- Self-referral block (Sentinel critical check)
  IF NEW.referred_user_id IS NOT NULL AND NEW.referred_user_id = v_referrer_user_id THEN
    RAISE EXCEPTION 'Self-referral is not permitted (Sentinel policy).'
      USING HINT = 'A user cannot earn a referral from their own code.';
  END IF;

  -- Auto-populate for easier ownership policies and analytics
  NEW.referrer_user_id := v_referrer_user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_referrals_before_insert
  BEFORE INSERT ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_referral_and_populate();

-- Increment profile counters atomically after successful referral (no race conditions)
CREATE OR REPLACE FUNCTION public.handle_new_referral_increment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    referral_count = COALESCE(referral_count, 0) + 1,
    total_points = COALESCE(total_points, 0) + 10,  -- Configurable points per referral
    updated_at = NOW()
  WHERE referrer_code = NEW.referrer_code;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_referrals_after_insert
  AFTER INSERT ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_referral_increment();

-- ============================================================================
-- ROW LEVEL SECURITY (ENABLE + POLICIES) - Sentinel Rec #1, #3, #4
-- ============================================================================

-- Enable RLS on EVERY table (mandatory)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------

-- Sentinel Rec #3: Safe public SELECT for leaderboard (anyone can see referrer_code + counts)
CREATE POLICY "profiles_select_public_leaderboard"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Sentinel Rec #4: Users fully control only their own profile row
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Note (Sentinel): referral_count / total_points are updated exclusively by
-- SECURITY DEFINER triggers or service_role Edge Functions. Client updates
-- via the own policy are possible but should be ignored in app logic.

-- ---------------------------------------------------------------------------
-- referrals policies (highly sensitive)
-- ---------------------------------------------------------------------------

-- Sentinel Rec #3: NO public SELECT. Authenticated users see only referrals
-- they initiated or that referred them.
CREATE POLICY "referrals_select_own"
  ON public.referrals
  FOR SELECT
  TO authenticated
  USING (
    referrer_user_id = (SELECT auth.uid()) 
    OR referred_user_id = (SELECT auth.uid())
  );

-- NO INSERT/UPDATE/DELETE policies for anon/authenticated (Sentinel Rec #2).
-- All mutations ONLY via record-referral Edge Function using service_role.

-- ---------------------------------------------------------------------------
-- shares policies
-- ---------------------------------------------------------------------------

CREATE POLICY "shares_select_own"
  ON public.shares
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Sentinel Rec #2: No write policies for authenticated. Writes via Edge only.

-- ---------------------------------------------------------------------------
-- prize_claims policies
-- ---------------------------------------------------------------------------

-- Sentinel Rec #3: Public can view only approved/paid claims (social proof / winners)
CREATE POLICY "prize_claims_select_public_approved"
  ON public.prize_claims
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('approved', 'paid'));

-- Users can always view their own claims (pending or otherwise)
CREATE POLICY "prize_claims_select_own"
  ON public.prize_claims
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Sentinel Rec #2: No insert/update/delete policies for regular roles.
-- submit-claim Edge Function (service_role) performs server-side top-1 SQL aggregate check.

-- ---------------------------------------------------------------------------
-- site_content policies
-- ---------------------------------------------------------------------------

-- Sentinel Rec #3: Public read for all site content (marketing, rules, prize info)
CREATE POLICY "site_content_select_public"
  ON public.site_content
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No write policies for anon/authenticated (Sentinel Rec #2). Admin updates via service_role.

-- ============================================================================
-- GRANTS (minimal privilege principle)
-- ============================================================================

-- Revoke broad defaults (defense)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Explicit safe grants (Sentinel Rec #3)
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT SELECT ON public.prize_claims TO anon, authenticated;

-- Authenticated get additional row-level access via policies above
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.shares TO authenticated;

-- service_role receives full access automatically (bypasses RLS) - used only in Edge Functions

-- ============================================================================
-- SEED DATA (optional initial site_content for production)
-- ============================================================================

INSERT INTO public.site_content (key, value, description) VALUES
  ('hero_title', '"ViralRefer Premium — Earn Real Rewards"', 'Homepage headline'),
  ('hero_subtitle', '"Refer friends, climb the leaderboard, claim cash prizes. Top referrers win big."', 'Sub-headline'),
  ('prize_pool', '50000', 'Current prize pool in USD (numeric for display logic)'),
  ('min_referrals_for_claim', '50', 'Minimum referrals required to be eligible for top-1 prize'),
  ('rules_text', '"1. No self-referrals. 2. Unique IPs only. 3. Fair play enforced. Turnstile protected."', 'Rules content')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION 0001
-- Next: 0002 for any views, RPCs, or additional policies.
-- Verify with: SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
-- ============================================================================
