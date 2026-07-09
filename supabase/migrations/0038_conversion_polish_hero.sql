-- Conversion polish: tight hero hierarchy, worldwide, no cash spam in CMS.

INSERT INTO public.site_content (key, value, description) VALUES
  ('hero_badge', '"WORLDWIDE • FREE"', 'Hero top badge'),
  ('hero_title_line1', '"Get your free link in 30 seconds."', 'Hero headline line 1'),
  ('hero_title_accent', '"Climb to #1 — claim homepage feature."', 'Hero gradient accent'),
  ('hero_subtitle', '"Open worldwide. No signup. One tap, then share anywhere."', 'Hero sub-headline'),
  ('hero_trust_line', '"Free recognition for #1 • Your link in ~5 seconds"', 'Hero trust line'),
  ('cta_button_text', '"Get my referral link"', 'Primary hero CTA'),
  ('leaderboard_button_text', '"See leaderboard"', 'Secondary hero CTA'),
  ('hero_campaign_badge', '"WORLDWIDE • FREE"', 'Campaign pill (slim/hidden on first paint)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
