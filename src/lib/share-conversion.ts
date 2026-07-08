/**
 * A/B share → signup conversion proxy (DBA analytics).
 * Joins tagged shares with per-code referral counts from admin.
 */

import type { ShareEvent } from '../admin/share-analytics-helpers';
import { isTestShareReferrerCode } from '../admin/share-analytics-helpers';

export type ConversionVariant = 'a' | 'b';

export interface VariantConversionRow {
  variant: ConversionVariant;
  shareCount: number;
  uniqueSharers: number;
  totalReferrals: number;
  referralsPerShare: number;
}

export interface ShareConversionSummary {
  rows: VariantConversionRow[];
  leaderVariant: ConversionVariant | null;
  insight: string;
}

function isTrackedVariant(v: string | undefined): v is ConversionVariant {
  return v === 'a' || v === 'b';
}

/**
 * Proxy conversion: for shares tagged A/B, sum referral counts for those sharer codes.
 * Not per-click attribution — cohort comparison for DBA/growth review.
 */
export function computeVariantConversion(
  shares: readonly ShareEvent[],
  referralCounts: Readonly<Record<string, number>>,
): ShareConversionSummary {
  const cohorts: Record<
    ConversionVariant,
    { shares: number; codes: Set<string> }
  > = {
    a: { shares: 0, codes: new Set() },
    b: { shares: 0, codes: new Set() },
  };

  for (const s of shares) {
    if (!isTrackedVariant(s.ab_variant)) continue;
    if (isTestShareReferrerCode(s.referrer_code)) continue;
    const code = (s.referrer_code || '').trim().toUpperCase();
    if (!code) continue;
    cohorts[s.ab_variant].shares += 1;
    cohorts[s.ab_variant].codes.add(code);
  }

  const rows: VariantConversionRow[] = (['a', 'b'] as const).map((variant) => {
    const { shares: shareCount, codes } = cohorts[variant];
    let totalReferrals = 0;
    codes.forEach((code) => {
      totalReferrals += referralCounts[code] ?? 0;
    });
    const referralsPerShare =
      shareCount > 0 ? Math.round((totalReferrals / shareCount) * 100) / 100 : 0;
    return {
      variant,
      shareCount,
      uniqueSharers: codes.size,
      totalReferrals,
      referralsPerShare,
    };
  });

  const withShares = rows.filter((r) => r.shareCount > 0);
  let leaderVariant: ConversionVariant | null = null;
  if (withShares.length >= 2) {
    leaderVariant = [...withShares].sort(
      (a, b) => b.referralsPerShare - a.referralsPerShare,
    )[0]!.variant;
  } else if (withShares.length === 1) {
    leaderVariant = withShares[0]!.variant;
  }

  let insight = 'No A/B-tagged shares yet — conversion tracking starts after Wave 6 shares.';
  if (withShares.length === 1) {
    const r = withShares[0]!;
    insight = `Variant ${r.variant.toUpperCase()}: ${r.referralsPerShare} signups/share (${r.totalReferrals} referrals from ${r.shareCount} shares)`;
  } else if (withShares.length >= 2) {
    const a = rows.find((r) => r.variant === 'a')!;
    const b = rows.find((r) => r.variant === 'b')!;
    insight = `A: ${a.referralsPerShare} signups/share (${a.totalReferrals}/${a.shareCount}) vs B: ${b.referralsPerShare} (${b.totalReferrals}/${b.shareCount})`;
    if (leaderVariant && a.referralsPerShare !== b.referralsPerShare) {
      insight += ` — Variant ${leaderVariant.toUpperCase()} leads on conversion proxy`;
    }
  }

  return { rows, leaderVariant, insight };
}