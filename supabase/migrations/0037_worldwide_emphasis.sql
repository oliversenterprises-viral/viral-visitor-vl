-- Emphasize open worldwide + no cash across public CMS strings.

INSERT INTO public.site_content (key, value, description) VALUES
  ('hero_badge', '"WORLDWIDE • FREE TO JOIN"', 'Hero top badge'),
  ('hero_subtitle', '"Free worldwide. No signup. Copy your link and share anywhere — every referral moves you up the live board."', 'Hero sub-headline'),
  ('hero_trust_line', '"Open worldwide • No email • No payment • Your link in ~5 seconds"', 'Hero trust line under CTAs'),
  ('hero_campaign_badge', '"WORLDWIDE • FREE • NO SIGNUP"', 'Hero campaign pill'),
  ('hero_title_accent', '"Climb to #1 — claim homepage feature."', 'Hero gradient accent line'),
  ('prize_subtitle', '"Open worldwide. #1 on the live board can claim a homepage feature for their website — free recognition, no cash prize."', 'Feature section subtitle'),
  ('prize_description', '"Open worldwide. #1 on the live board can claim a homepage feature for their website — free recognition, no cash prize."', 'Feature section description'),
  ('share_message_template', '"Worldwide free leaderboard — grab your link in ~30 sec. #1 can claim a homepage feature. {link}"', 'Default share message'),
  ('how_it_works_subtitle', '"Three steps. Under ten minutes. Open worldwide. Free forever."', 'How it works subtitle')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
