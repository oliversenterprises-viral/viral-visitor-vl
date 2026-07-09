/**
 * Public homepage activity feed — merge referrals + shares, velocity (Phase 1).
 */

import { isTestShareReferrerCode } from '../admin/share-analytics-helpers';
import { formatRankMoveLabel, type RankMoveActivityRow } from './rank-move-activity';
import { isTestReferralRecord } from './test-referral';
import { t, type MessageKey } from './i18n';

function asRankMove(row: PublicActivityRow): RankMoveActivityRow | null {
  if (row.kind !== 'rank_move' || row.new_rank == null) return null;
  return row as RankMoveActivityRow;
}

export type PublicActivityKind = 'referral' | 'share' | 'rank_move';

export interface PublicActivityRow {
  kind: PublicActivityKind;
  referrer_code: string;
  created_at: string;
  platform?: string;
  previous_rank?: number | null;
  new_rank?: number;
}

export interface ReferralTimestampRow {
  referrer_code: string;
  created_at: string;
}

export interface ShareTimestampRow {
  referrer_code: string;
  created_at: string;
  platform?: string;
}

const VELOCITY_WINDOW_MS = 60 * 60 * 1000;

/** Filter smoke/agent/owner test referral rows. */
export function filterPublicReferralRows(
  rows: readonly ReferralTimestampRow[],
): ReferralTimestampRow[] {
  return rows.filter((row) => !isTestReferralRecord(row as unknown as Record<string, unknown>));
}

/** Filter smoke/agent test share rows. */
export function filterPublicShareRows(rows: readonly ShareTimestampRow[]): ShareTimestampRow[] {
  return rows.filter((row) => !isTestShareReferrerCode(row.referrer_code));
}

/** Merge referrals + shares, newest first, capped. */
export function mergePublicActivityRows(
  referrals: readonly ReferralTimestampRow[],
  shares: readonly ShareTimestampRow[],
  limit = 8,
): PublicActivityRow[] {
  const merged: PublicActivityRow[] = [
    ...filterPublicReferralRows(referrals).map((r) => ({
      kind: 'referral' as const,
      referrer_code: r.referrer_code,
      created_at: r.created_at,
    })),
    ...filterPublicShareRows(shares).map((s) => ({
      kind: 'share' as const,
      referrer_code: s.referrer_code,
      created_at: s.created_at,
      platform: s.platform,
    })),
  ];

  return merged
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

/** Count real referrals credited within the last hour (for velocity pill). */
export function countReferralVelocityLastHour(
  referrals: readonly ReferralTimestampRow[],
  now = Date.now(),
  windowMs = VELOCITY_WINDOW_MS,
): number {
  const cutoff = now - windowMs;
  return filterPublicReferralRows(referrals).filter((row) => {
    const ts = new Date(row.created_at).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}

/** Human label for share platform chips on the public feed. */
export function formatSharePlatformLabel(platform: string | undefined): string {
  const p = String(platform || '').trim().toLowerCase();
  const map: Record<string, string> = {
    twitter: 'Twitter',
    x: 'X',
    facebook: 'Facebook',
    reddit: 'Reddit',
    whatsapp: 'WhatsApp',
    linkedin: 'LinkedIn',
    telegram: 'Telegram',
    copy: 'link copy',
    clipboard: 'link copy',
    native: 'native share',
  };
  if (!p) return 'social';
  return map[p] || platform!.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Velocity pill HTML — hidden when count is 0. */
export function buildActivityVelocityHtml(count: number): string {
  if (count <= 0) return '';
  const label =
    count === 1 ? '1 referral in the last hour' : `${count} referrals in the last hour`;
  return `<span class="inline-flex items-center gap-1.5 text-xs text-violet-300/95 mt-1" id="recent-activity-velocity-inner" role="status">
    <span class="text-amber-400" aria-hidden="true">⚡</span>${label}
  </span>`;
}

/** One-line social proof for referred-landing hero (Phase 2). */
export function buildReferredHeroSocialProofText(
  rows: readonly PublicActivityRow[],
  velocityLastHour: number,
): string {
  const parts: string[] = [];

  if (velocityLastHour > 0) {
    parts.push(
      velocityLastHour === 1
        ? '1 referral in the last hour'
        : `${velocityLastHour} referrals in the last hour`,
    );
  }

  const rankLatest = rows.map(asRankMove).find((r) => r != null);
  if (rankLatest) {
    parts.push(`${rankLatest.referrer_code} ${formatRankMoveLabel(rankLatest)}`);
  } else {
    const latest = rows[0];
    if (latest?.kind === 'share') {
      const platform = formatSharePlatformLabel(latest.platform);
      parts.push(`${latest.referrer_code} just shared on ${platform}`);
    } else if (latest?.kind === 'referral') {
      parts.push(`${latest.referrer_code} just joined`);
    }
  }

  return parts.join(' · ');
}

/** One-line social proof for direct homepage landings (P1). Always returns FOMO if board quiet. */
export function buildDirectHeroSocialProofText(
  rows: readonly PublicActivityRow[],
  velocityLastHour: number,
  uniqueReferrers: number,
  leaderCount = 0,
): string {
  const parts: string[] = [];

  if (leaderCount > 0 && uniqueReferrers <= 3) {
    parts.push(t('proof.fomo_thin' as MessageKey, { n: leaderCount }));
  } else if (uniqueReferrers === 1) {
    parts.push(t('proof.competing_one' as MessageKey));
  } else if (uniqueReferrers > 1) {
    parts.push(t('proof.competing_n' as MessageKey, { n: uniqueReferrers }));
  }

  if (velocityLastHour === 1) {
    parts.push(t('proof.velocity_one' as MessageKey));
  } else if (velocityLastHour > 1) {
    parts.push(t('proof.velocity_n' as MessageKey, { n: velocityLastHour }));
  }

  const rankLatest = rows.map(asRankMove).find((r) => r != null);
  if (rankLatest) {
    parts.push(`${rankLatest.referrer_code} ${formatRankMoveLabel(rankLatest)}`);
  } else {
    const latest = rows[0];
    if (latest?.kind === 'share') {
      const platform = formatSharePlatformLabel(latest.platform);
      parts.push(
        t('proof.just_shared' as MessageKey, {
          code: latest.referrer_code,
          platform,
        }),
      );
    } else if (latest?.kind === 'referral') {
      parts.push(t('proof.just_joined' as MessageKey, { code: latest.referrer_code }));
    }
  }

  // Never return empty — thin boards need FOMO, not silence
  if (!parts.length) return t('proof.fomo_empty' as MessageKey);
  return parts.join(' · ');
}

function buildHeroSocialProofHtml(line: string): string {
  if (!line) return '';
  return `<div class="hero-referred-social-proof inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-sm text-emerald-50/95 max-w-xl mx-auto shadow-[0_0_24px_rgba(16,185,129,0.12)]">
    <span class="text-amber-400 shrink-0" aria-hidden="true">⚡</span>
    <span class="text-center leading-snug">${escapeHtml(line)}</span>
    <span class="hero-live-dot shrink-0" aria-hidden="true"></span>
  </div>`;
}

/** Hero pill HTML for /r/CODE and ?ref= landings — empty when no signal. */
export function buildReferredHeroSocialProofHtml(
  rows: readonly PublicActivityRow[],
  velocityLastHour: number,
): string {
  return buildHeroSocialProofHtml(buildReferredHeroSocialProofText(rows, velocityLastHour));
}

/** Hero pill HTML for direct landings — empty when no signal. */
export function buildDirectHeroSocialProofHtml(
  rows: readonly PublicActivityRow[],
  velocityLastHour: number,
  uniqueReferrers: number,
  leaderCount = 0,
): string {
  return buildHeroSocialProofHtml(
    buildDirectHeroSocialProofText(rows, velocityLastHour, uniqueReferrers, leaderCount),
  );
}