-- Open ViralRefer worldwide (not US-only). Align public rules CMS copy.

INSERT INTO public.site_content (key, value, description) VALUES
  (
    'rules_text',
    '"Open worldwide, 18+ (or age of majority if higher). No purchase necessary. Free leaderboard — homepage feature for #1 after verification. No cash prizes. No self-referrals. Fair play enforced."',
    'Footer key rules blurb'
  ),
  (
    'rules_full',
    '"Full rules for the ViralRefer free referral leaderboard.\n\nEligibility: Open worldwide to anyone age 18+ (or the age of majority in their jurisdiction, if higher). No purchase necessary. Free forever. Void where prohibited.\n\nNo self-referrals, shared devices, bots, or fraud. All referrals verified server-side via Edge Functions, IP checks, and Turnstile.\n\n#1 (top verified referrers meeting min threshold) may claim a homepage banner feature via secure form after verification. There is no cash prize. All decisions final."',
    'Official rules modal full text'
  ),
  (
    'footer_legal_disclaimer',
    '"© 2026 ViralRefer. All rights reserved. Free skill-based referral leaderboard. NO PURCHASE OR PAYMENT NECESSARY. Open worldwide to participants age 18+ (or age of majority where higher). Void where prohibited. Rankings by verified unique referrals. Homepage features subject to Official Rules. No cash prizes. Fraud or abuse results in disqualification."',
    'Footer legal disclaimer paragraph'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
