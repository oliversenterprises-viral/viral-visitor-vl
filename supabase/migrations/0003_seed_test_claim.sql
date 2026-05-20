-- Temporary test claim for development
INSERT INTO public.prize_claims ( -- renamed via 0004 migration
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
