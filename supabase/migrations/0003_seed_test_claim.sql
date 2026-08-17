-- Temporary test claim for development
-- Skip on fresh preview when prize_claims is still the 0001 shape (no website_url).
DO $$
BEGIN
  IF to_regclass('public.prize_claims') IS NULL THEN
    RAISE NOTICE 'skip 0003 seed — prize_claims missing';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prize_claims'
      AND column_name = 'website_url'
  ) THEN
    RAISE NOTICE 'skip 0003 seed — prize_claims has no website_url (0001 shape)';
    RETURN;
  END IF;

  INSERT INTO public.prize_claims (
    id,
    created_at,
    referrer_code,
    website_url,
    cashapp_cashtag,
    message,
    status
  ) VALUES (
    gen_random_uuid(),
    NOW(),
    'TESTABC123',
    'https://myawesomeproject.com',
    '$testuser',
    'I built a really cool productivity tool and would love to get featured on your homepage!',
    'pending'
  );
END $$;
