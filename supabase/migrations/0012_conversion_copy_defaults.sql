-- Conversion-focused homepage copy (Reddit ads + funnel). Updates existing keys where present.
INSERT INTO public.site_content (key, value, description) VALUES
  ('hero_title_line1', '"Get your link in 30 seconds."', 'Hero headline line 1'),
  ('hero_title_accent', '"Win homepage feature + $10."', 'Hero headline accent (gradient)'),
  ('hero_title', '"Win homepage feature + $10."', 'Back-compat hero accent'),
  ('hero_subtitle', '"Free — no signup. Tap the button, copy your link, and share anywhere. #1 referrer wins a full homepage banner + $10 Cash App."', 'Sub-headline'),
  ('hero_campaign_badge', '"FREE • NO SIGNUP • ~30 SEC"', 'Hero campaign badge'),
  ('winning_link_description', '"Copy your link below and share on Reddit, X, or anywhere — every click counts toward #1."', 'Winning link section description'),
  ('referral_next_step_hint', '"Link ready! Hit COPY, then paste on Reddit or DM a friend."', 'Post-link next step hint'),
  ('share_message_template', '"Free to join — grab your link in ~30 sec. #1 wins homepage feature + $10 Cash App. {link}"', 'Default share message ({link} placeholder)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;