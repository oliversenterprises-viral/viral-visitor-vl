-- P1 conversion boost (Phase 3): referred share-first + prize-forward hero CTA test.
UPDATE public.site_content
SET
  value = COALESCE(value::jsonb, '{}'::jsonb)
    || '{"referred_share_first":true,"hero_cta_variant":"prize","p1_conversion_boost":"2026-07-06"}'::jsonb,
  updated_at = NOW()
WHERE key = 'optimizer_flags';