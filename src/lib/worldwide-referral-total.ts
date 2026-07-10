/**
 * Public display of the verified worldwide referral total.
 * Source of truth: get_total_referral_count (excludes owner/smoke/test rows).
 * Shown to everyone — not gated on having a link.
 */

import { t, type MessageKey } from './i18n';

export function formatVerifiedReferralTotalLabel(total: number): string {
  if (total === 1) return 'verified referral worldwide';
  return 'verified referrals worldwide';
}

/** Short live strip for hero global proof / compact surfaces. */
export function formatVerifiedReferralTotalLive(total: number): string {
  if (total <= 0) return t('proof.live_default' as MessageKey);
  if (total === 1) return '1 verified referral worldwide';
  return `${total.toLocaleString()} verified referrals worldwide`;
}

/** Secondary line: board competitors + #1 progress (does not replace the total). */
export function formatVerifiedReferralTotalMeta(
  uniqueReferrers: number,
  leaderCount: number,
): string {
  const parts: string[] = [];
  if (uniqueReferrers === 1) {
    parts.push('1 person on the live board');
  } else if (uniqueReferrers > 1) {
    parts.push(`${uniqueReferrers.toLocaleString()} people on the live board`);
  }
  if (leaderCount > 0) {
    const refLabel =
      leaderCount === 1 ? '1 referral' : `${leaderCount.toLocaleString()} referrals`;
    parts.push(`#1 has ${refLabel}`);
  }
  if (!parts.length) return 'Real-time · test traffic excluded';
  return `${parts.join(' · ')} · real-time`;
}

/**
 * Paint the verified total everywhere it appears.
 * Keeps #total-referrers as the primary numeric element (e2e + existing hooks).
 */
export function applyWorldwideReferralTotal(input: {
  total: number;
  uniqueReferrers?: number;
  leaderCount?: number;
}): void {
  const total = Math.max(0, Math.floor(Number(input.total) || 0));
  const unique = Math.max(0, Math.floor(Number(input.uniqueReferrers) || 0));
  const leader = Math.max(0, Math.floor(Number(input.leaderCount) || 0));
  const numText = total.toLocaleString();

  const numEl = document.getElementById('total-referrers');
  if (numEl) {
    numEl.textContent = numText;
    numEl.setAttribute('data-vr-total-verified', String(total));
  }

  const labelEl = document.getElementById('hero-stats-suffix');
  if (labelEl) {
    labelEl.textContent = ` ${formatVerifiedReferralTotalLabel(total)}`;
  }

  const metaEl = document.getElementById('hero-board-meta');
  if (metaEl) {
    metaEl.textContent = formatVerifiedReferralTotalMeta(unique, leader);
  }

  const globalLive = document.getElementById('hero-global-proof-live');
  if (globalLive) {
    globalLive.textContent = formatVerifiedReferralTotalLive(total);
    globalLive.removeAttribute('data-i18n');
  }

  const lbTotal = document.getElementById('leaderboard-total-referrals');
  if (lbTotal) lbTotal.textContent = numText;

  const lbLabel = document.getElementById('leaderboard-total-label');
  if (lbLabel) {
    lbLabel.textContent =
      total === 1 ? 'verified referral worldwide' : 'verified referrals worldwide';
  }

  const root = document.getElementById('vr-verified-total');
  if (root) {
    root.classList.toggle('vr-verified-total--ready', total > 0 || unique > 0);
    root.setAttribute('aria-label', `${numText} ${formatVerifiedReferralTotalLabel(total)}`);
  }
}
