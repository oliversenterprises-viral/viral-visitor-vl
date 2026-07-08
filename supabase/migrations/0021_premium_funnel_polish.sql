-- Premium funnel polish: conversion copy, funnel coach strings, and color defaults.
-- Editable live via Admin → Edit Content and Admin → Text Colors.

INSERT INTO public.site_content (key, value, description) VALUES
  ('hero_title_line1', '"Get your winning link in 30 seconds."', 'Hero headline line 1'),
  ('hero_title_accent', '"Climb to #1 — win homepage + $10."', 'Hero gradient accent line'),
  ('hero_title', '"Get your winning link in 30 seconds."', 'Legacy headline (maps to line 1)'),
  ('hero_subtitle', '"Free. No signup. Copy your link and share anywhere — every referral moves you up the live board."', 'Hero sub-headline'),
  ('hero_badge', '"LIVE CONTEST • FREE TO JOIN"', 'Hero top badge'),
  ('hero_trust_line', '"No email • No payment • No catch • Your link in ~5 seconds"', 'Hero trust line under CTAs'),
  ('hero_campaign_badge', '"FREE • NO SIGNUP • ~30 SEC"', 'Hero campaign pill'),
  ('cta_button_text', '"Get my referral link"', 'Primary hero CTA label'),
  ('leaderboard_button_text', '"See leaderboard"', 'Secondary hero CTA label'),
  ('funnel_journey_badge', '"YOUR 3-STEP PATH TO #1"', 'Above-fold funnel card badge'),
  ('funnel_step1_label', '"1. Get link"', 'Funnel step 1 chip label'),
  ('funnel_step2_label', '"2. Copy"', 'Funnel step 2 chip label'),
  ('funnel_step3_label', '"3. Share & win"', 'Funnel step 3 chip label'),
  ('funnel_guide_step1', '"Step 1: tap Get my referral link — your unique winning link appears below."', 'Funnel coach copy — step 1'),
  ('funnel_guide_step2', '"Step 2: tap COPY — your link is ready to paste anywhere."', 'Funnel coach copy — step 2'),
  ('funnel_guide_step3', '"Step 3: tap WhatsApp (or any share button) — every click climbs the board."', 'Funnel coach copy — step 3'),
  ('funnel_guide_complete', '"You shared! Every click through your link moves you closer to #1."', 'Funnel coach — after first share'),
  ('funnel_credit_gate_title', '"Complete Step 1 to count as a real referral"', 'Referred visitor credit gate title'),
  ('winning_link_title', '"Your winning link"', 'Referral section heading'),
  ('winning_link_description', '"Copy below and share on Reddit, X, WhatsApp, or anywhere — every click counts toward #1."', 'Referral section subheading'),
  ('how_it_works_subtitle', '"Three steps. Under ten minutes. Real prizes."', 'How it works subtitle'),
  ('color_funnel_active', '"#e9d5ff"', 'Funnel active step text color'),
  ('color_funnel_done', '"#34d399"', 'Funnel completed step text color'),
  ('color_funnel_coach', '"#e4e4e7"', 'Funnel coach strip text color'),
  ('color_funnel_arrow', '"#a78bfa"', 'Funnel arrow flow color'),
  ('color_hero_accent', '"#d8b4fe"', 'Hero accent fallback'),
  ('color_referral_link', '"#4ade80"', 'Referral link URL color')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();