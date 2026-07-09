-- Remove cash / Cash App messaging from public site_content CMS.
-- Public product is free leaderboard + homepage feature only.

INSERT INTO public.site_content (key, value, description) VALUES
  ('hero_title_line1', '"Get your free link in 30 seconds."', 'Hero headline line 1'),
  ('hero_title_accent', '"Climb to #1 — claim homepage feature."', 'Hero gradient accent line'),
  ('hero_title', '"Get your free link in 30 seconds."', 'Legacy headline (maps to line 1)'),
  ('hero_subtitle', '"Free. No signup. Copy your link and share anywhere — every referral moves you up the live board. #1 can claim a homepage feature."', 'Hero sub-headline'),
  ('hero_badge', '"FREE LEADERBOARD • NO SIGNUP"', 'Hero top badge'),
  ('hero_trust_line', '"No email • No payment • No catch • Your link in ~5 seconds"', 'Hero trust line under CTAs'),
  ('hero_campaign_badge', '"FREE • NO SIGNUP • ~30 SEC"', 'Hero campaign pill'),
  ('funnel_step3_label', '"3. Share & climb"', 'Funnel step 3 chip label'),
  ('how_it_works_subtitle', '"Three steps. Under ten minutes. Free forever."', 'How it works subtitle'),
  ('how_step3_title', '"3. Climb & get featured"', 'How it works step 3 title'),
  ('how_it_works_step3', '"Reach the top of the leaderboard and claim a homepage feature for your site — no cash prize."', 'How it works step 3 body'),
  ('prize_badge', '"HOMEPAGE FEATURE"', 'Prize/feature section badge'),
  ('prize_title', '"Homepage Banner Feature"', 'Feature section title'),
  ('prize_description', '"#1 on the live board can claim a homepage feature for their website — free recognition, no cash prize."', 'Feature section description'),
  ('prize_subtitle', '"#1 on the live board can claim a homepage feature for their website — free recognition, no cash prize."', 'Feature section subtitle'),
  ('current_winner_badge', '"CURRENT #1 CAN CLAIM THIS"', 'Winner badge under claim CTA'),
  ('cash_amount', '""', 'Deprecated — cash removed from public product'),
  ('share_message_template', '"Free to join — grab your link in ~30 sec. Climb the live leaderboard. #1 can claim a homepage feature. {link}"', 'Default share message ({link} placeholder)'),
  ('winning_link_description', '"Copy below and share on Reddit, X, WhatsApp, or anywhere — every click counts toward #1."', 'Referral section subheading'),
  ('rules_text', '"NO PURCHASE NECESSARY. Free leaderboard. Homepage features subject to eligibility verification and Official Rules. No cash prizes. Fraud or abuse results in disqualification."', 'Footer rules blurb')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
