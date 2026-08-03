-- ============================================================================
-- 0045_daily_crown.sql
-- Daily Crown: no-cash 24h UTC top-referrer incentive (additive public RPCs only).
-- Does NOT alter referrals, record-referral, or main get_leaderboard scoring.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_daily_crown_status(p_hall_days int DEFAULT 14)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS today_utc,
      GREATEST(COALESCE(p_hall_days, 14), 1)::INTEGER AS hall_days
  ),
  windowed AS (
    SELECT
      (r.created_at AT TIME ZONE 'UTC')::date AS day_utc,
      r.referrer_code,
      r.created_at
    FROM public.referrals r
    CROSS JOIN bounds b
    WHERE NOT public.is_test_referral_row(r.referrer_code, r.referred_ip, r.user_agent)
      AND (r.created_at AT TIME ZONE 'UTC')::date >= (b.today_utc - (b.hall_days || ' days')::interval)::date
      AND (r.created_at AT TIME ZONE 'UTC')::date <= b.today_utc
  ),
  day_counts AS (
    SELECT
      w.day_utc,
      w.referrer_code,
      COUNT(*)::INTEGER AS referral_count,
      MIN(w.created_at) AS first_at
    FROM windowed w
    GROUP BY w.day_utc, w.referrer_code
  ),
  day_winners AS (
    SELECT DISTINCT ON (dc.day_utc)
      dc.day_utc,
      dc.referrer_code,
      dc.referral_count,
      dc.first_at
    FROM day_counts dc
    ORDER BY dc.day_utc DESC, dc.referral_count DESC, dc.first_at ASC
  ),
  today_board AS (
    SELECT
      ranked.referrer_code,
      ranked.referral_count,
      ranked.rank
    FROM (
      SELECT
        dc.referrer_code,
        dc.referral_count,
        ROW_NUMBER() OVER (ORDER BY dc.referral_count DESC, dc.first_at ASC)::INTEGER AS rank
      FROM day_counts dc
      CROSS JOIN bounds b
      WHERE dc.day_utc = b.today_utc
    ) ranked
    WHERE ranked.rank <= 8
    ORDER BY ranked.rank ASC
  ),
  yesterday_champ AS (
    SELECT dw.day_utc, dw.referrer_code, dw.referral_count
    FROM day_winners dw
    CROSS JOIN bounds b
    WHERE dw.day_utc = b.today_utc - 1
  ),
  hall AS (
    SELECT
      h.day_utc,
      h.referrer_code,
      h.referral_count
    FROM (
      SELECT
        dw.day_utc,
        dw.referrer_code,
        dw.referral_count,
        ROW_NUMBER() OVER (ORDER BY dw.day_utc DESC)::INTEGER AS rn
      FROM day_winners dw
      CROSS JOIN bounds b
      WHERE dw.day_utc < b.today_utc
    ) h
    CROSS JOIN bounds b
    WHERE h.rn <= b.hall_days
    ORDER BY h.day_utc DESC
  )
  SELECT json_build_object(
    'timezone', 'UTC',
    'today_utc', (SELECT today_utc FROM bounds),
    'window_start', ((SELECT today_utc FROM bounds)::timestamp AT TIME ZONE 'UTC'),
    'window_end', (((SELECT today_utc FROM bounds) + 1)::timestamp AT TIME ZONE 'UTC'),
    'seconds_remaining', GREATEST(
      0,
      EXTRACT(EPOCH FROM (
        (((SELECT today_utc FROM bounds) + 1)::timestamp AT TIME ZONE 'UTC') - NOW()
      ))::INTEGER
    ),
    'current_leader', (
      SELECT CASE WHEN tb.referrer_code IS NULL THEN NULL ELSE json_build_object(
        'referrer_code', tb.referrer_code,
        'referral_count', tb.referral_count,
        'rank', tb.rank
      ) END
      FROM (SELECT * FROM today_board ORDER BY rank ASC LIMIT 1) tb
    ),
    'today_board', COALESCE(
      (SELECT json_agg(json_build_object(
        'referrer_code', tb.referrer_code,
        'referral_count', tb.referral_count,
        'rank', tb.rank
      ) ORDER BY tb.rank ASC) FROM today_board tb),
      '[]'::JSON
    ),
    'yesterday_champion', (
      SELECT CASE WHEN yc.referrer_code IS NULL THEN NULL ELSE json_build_object(
        'day_utc', yc.day_utc,
        'referrer_code', yc.referrer_code,
        'referral_count', yc.referral_count
      ) END
      FROM yesterday_champ yc
      LIMIT 1
    ),
    'hall', COALESCE(
      (SELECT json_agg(json_build_object(
        'day_utc', h.day_utc,
        'referrer_code', h.referrer_code,
        'referral_count', h.referral_count
      ) ORDER BY h.day_utc DESC) FROM hall h),
      '[]'::JSON
    )
  );
$$;

COMMENT ON FUNCTION public.get_daily_crown_status(int) IS
  'Daily Crown status: current UTC-day race, yesterday champion strip, Hall of Crowns. No-cash incentive; separate from main homepage feature prize.';

GRANT EXECUTE ON FUNCTION public.get_daily_crown_status(int) TO anon, authenticated;
