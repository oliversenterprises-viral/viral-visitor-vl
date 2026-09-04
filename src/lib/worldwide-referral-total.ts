/**
 * Public display of the verified worldwide referral total + "got a link today".
 * Verified credits: get_total_referral_count (excludes owner/smoke/test rows).
 * Got a link: unique GetReferralLink visitors in the last 24h (public RPC).
 * Shown to everyone — not gated on having a link.
 */

import { t, type MessageKey } from './i18n';

export function formatVerifiedReferralTotalLabel(total: number): string {
  if (total === 1) return t('proof.verified_label_one' as MessageKey);
  return t('proof.verified_label' as MessageKey);
}

/** Short live strip for hero global proof / compact surfaces. */
export function formatVerifiedReferralTotalLive(total: number): string {
  if (total <= 0) return t('proof.live_default' as MessageKey);
  if (total === 1) return t('proof.verified_live_one' as MessageKey);
  return t('proof.verified_live_n' as MessageKey, { n: total.toLocaleString() });
}

/**
 * Primary second-line copy: how many people tapped Get my referral link (rolling 24h).
 * Falls back to board meta when the get-link window is empty / unknown.
 */
export function formatPeopleGotLinkToday(uniquePeople: number): string {
  const n = Math.max(0, Math.floor(Number(uniquePeople) || 0));
  if (n === 1) return t('proof.got_link_one' as MessageKey);
  if (n > 1) return t('proof.got_link_n' as MessageKey, { n: n.toLocaleString() });
  return t('proof.got_link_first' as MessageKey);
}

/** Tertiary line: board competitors + #1 progress. */
export function formatVerifiedReferralTotalMeta(
  uniqueReferrers: number,
  leaderCount: number,
): string {
  const parts: string[] = [];
  if (uniqueReferrers === 1) {
    parts.push(t('proof.live_one' as MessageKey));
  } else if (uniqueReferrers > 1) {
    parts.push(t('proof.meta_people_n' as MessageKey, { n: uniqueReferrers.toLocaleString() }));
  }
  if (leaderCount === 1) {
    parts.push(t('proof.leader_has_one' as MessageKey));
  } else if (leaderCount > 0) {
    parts.push(t('proof.leader_has_n' as MessageKey, { n: leaderCount.toLocaleString() }));
  }
  if (!parts.length) return t('proof.credits_empty' as MessageKey);
  return `${parts.join(' · ')} · ${t('proof.credits_only' as MessageKey)}`;
}

/**
 * Paint the verified total + get-link activity everywhere they appear.
 * Keeps #total-referrers as the primary numeric element (e2e + existing hooks).
 */
let lastWorldwideInput = {
  total: 0,
  uniqueReferrers: 0,
  leaderCount: 0,
  peopleGotLinkToday: 0,
};

export function applyWorldwideReferralTotal(input: {
  total: number;
  uniqueReferrers?: number;
  leaderCount?: number;
  /** Unique people who tapped Get my referral link in the last 24h */
  peopleGotLinkToday?: number;
}): void {
  lastWorldwideInput = {
    total: Math.max(0, Math.floor(Number(input.total) || 0)),
    uniqueReferrers: Math.max(0, Math.floor(Number(input.uniqueReferrers) || 0)),
    leaderCount: Math.max(0, Math.floor(Number(input.leaderCount) || 0)),
    peopleGotLinkToday: Math.max(0, Math.floor(Number(input.peopleGotLinkToday) || 0)),
  };
  const total = lastWorldwideInput.total;
  const unique = Math.max(0, Math.floor(Number(input.uniqueReferrers) || 0));
  const leader = Math.max(0, Math.floor(Number(input.leaderCount) || 0));
  const gotLink = Math.max(0, Math.floor(Number(input.peopleGotLinkToday) || 0));
  const numText = total.toLocaleString();

  const numEl = document.getElementById('total-referrers');
  const labelEl = document.getElementById('hero-stats-suffix');
  if (total <= 0) {
    if (numEl) {
      numEl.textContent = '';
      numEl.setAttribute('data-vr-total-verified', '0');
    }
    if (labelEl) labelEl.textContent = t('proof.board_open_line' as MessageKey);
  } else {
    if (numEl) {
      numEl.textContent = numText;
      numEl.setAttribute('data-vr-total-verified', String(total));
    }
    if (labelEl) {
      labelEl.textContent = ` ${formatVerifiedReferralTotalLabel(total)}`;
    }
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
  const lbLabel = document.getElementById('leaderboard-total-label');
  if (total <= 0 && unique <= 0) {
    if (lbTotal) lbTotal.textContent = '';
    if (lbLabel) lbLabel.textContent = t('proof.board_open_line' as MessageKey);
  } else {
    if (lbTotal) lbTotal.textContent = numText;
    if (lbLabel) {
      lbLabel.textContent = formatVerifiedReferralTotalLabel(total);
    }
  }

  const lbGotLink = document.getElementById('leaderboard-got-link-today');
  if (lbGotLink) {
    lbGotLink.textContent = gotLink > 0 ? formatPeopleGotLinkToday(gotLink) : '';
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

export function reapplyWorldwideReferralTotal(): void {
  applyWorldwideReferralTotal(lastWorldwideInput);
}
