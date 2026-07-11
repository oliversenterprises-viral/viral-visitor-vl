/**
 * Public display of the verified worldwide referral total + "got a link today".
 * Verified credits: get_total_referral_count (excludes owner/smoke/test rows).
 * Got a link: unique GetReferralLink visitors in the last 24h (public RPC).
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

/**
 * Primary second-line copy: how many people tapped Get my referral link (rolling 24h).
 * Falls back to board meta when the get-link window is empty / unknown.
 */
export function formatPeopleGotLinkToday(uniquePeople: number): string {
  const n = Math.max(0, Math.floor(Number(uniquePeople) || 0));
  if (n === 1) return '1 person got a link today';
  if (n > 1) return `${n.toLocaleString()} people got a link today`;
  return 'Be among the first to get a link today';
}

/** Tertiary line: board competitors + #1 progress. */
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
  if (!parts.length) return 'Verified credits · test traffic excluded';
  return `${parts.join(' · ')} · verified credits only`;
}

/**
 * Paint the verified total + get-link activity everywhere they appear.
 * Keeps #total-referrers as the primary numeric element (e2e + existing hooks).
 */
export function applyWorldwideReferralTotal(input: {
  total: number;
  uniqueReferrers?: number;
  leaderCount?: number;
  /** Unique people who tapped Get my referral link in the last 24h */
  peopleGotLinkToday?: number;
}): void {
  const total = Math.max(0, Math.floor(Number(input.total) || 0));
  const unique = Math.max(0, Math.floor(Number(input.uniqueReferrers) || 0));
  const leader = Math.max(0, Math.floor(Number(input.leaderCount) || 0));
  const gotLink = Math.max(0, Math.floor(Number(input.peopleGotLinkToday) || 0));
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

  // Prominent second line: get-link activity (what admin funnel "Get link" shows)
  const gotLinkEl = document.getElementById('hero-got-link-today');
  if (gotLinkEl) {
    gotLinkEl.textContent = formatPeopleGotLinkToday(gotLink);
    gotLinkEl.setAttribute('data-vr-got-link-today', String(gotLink));
    gotLinkEl.classList.toggle('vr-got-link-today--active', gotLink > 0);
  }

  const metaEl = document.getElementById('hero-board-meta');
  if (metaEl) {
    metaEl.textContent = formatVerifiedReferralTotalMeta(unique, leader);
  }

  const globalLive = document.getElementById('hero-global-proof-live');
  if (globalLive) {
    // Prefer get-link energy when live; always keep verified total in the main card
    if (gotLink > 0) {
      globalLive.textContent = formatPeopleGotLinkToday(gotLink);
    } else {
      globalLive.textContent = formatVerifiedReferralTotalLive(total);
    }
    globalLive.removeAttribute('data-i18n');
  }

  const lbTotal = document.getElementById('leaderboard-total-referrals');
  if (lbTotal) lbTotal.textContent = numText;

  const lbLabel = document.getElementById('leaderboard-total-label');
  if (lbLabel) {
    lbLabel.textContent =
      total === 1 ? 'verified referral worldwide' : 'verified referrals worldwide';
  }

  const lbGotLink = document.getElementById('leaderboard-got-link-today');
  if (lbGotLink) {
    lbGotLink.textContent = formatPeopleGotLinkToday(gotLink);
    lbGotLink.setAttribute('data-vr-got-link-today', String(gotLink));
  }

  const root = document.getElementById('vr-verified-total');
  if (root) {
    root.classList.toggle('vr-verified-total--ready', total > 0 || unique > 0 || gotLink > 0);
    root.setAttribute(
      'aria-label',
      `${numText} ${formatVerifiedReferralTotalLabel(total)}. ${formatPeopleGotLinkToday(gotLink)}`,
    );
  }
}
