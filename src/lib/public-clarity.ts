/**
 * Public clarity — navigation, hero stats copy, direct-landing focus (no funnel logic changes).
 */

import { isReferredLanding } from './funnel-conversion';
import { hasReferralLinkInUI } from './visitor-slim';
import { initExitIntentRescue } from './exit-intent-rescue';
import { t, type MessageKey } from './i18n';

const NAV_SECTIONS = [
  { id: 'how', href: '#how' },
  { id: 'prize', href: '#prize' },
  { id: 'leaderboard', href: '#leaderboard' },
] as const;

/** Hero subtext under referrer count — FOMO when board is thin. */
export function formatHeroStatsSubtext(
  uniqueReferrers: number,
  leaderCount: number,
): string {
  if (leaderCount > 0 && uniqueReferrers <= 3) {
    const refLabel =
      leaderCount === 1 ? '1 referral' : `${leaderCount.toLocaleString()} referrals`;
    return t('proof.stats_thin' as MessageKey, { n: refLabel });
  }
  if (uniqueReferrers <= 1) {
    return t('proof.stats_first' as MessageKey);
  }
  return t('proof.stats_open' as MessageKey);
}

/** Live segment of the global proof strip under hero subtitle. */
export function formatHeroGlobalProofLive(uniqueReferrers: number): string {
  if (uniqueReferrers <= 0) return t('proof.live_default' as MessageKey);
  if (uniqueReferrers === 1) return t('proof.live_one' as MessageKey);
  return t('proof.live_n' as MessageKey, { n: uniqueReferrers.toLocaleString() });
}

export function applyHeroStatsSubtext(uniqueReferrers: number, leaderCount: number): void {
  const people = t('proof.stats_people' as MessageKey);
  const suffixEl = document.getElementById('hero-stats-suffix');
  if (suffixEl) {
    suffixEl.textContent = `${people}${formatHeroStatsSubtext(uniqueReferrers, leaderCount)}`;
  } else {
    const el = document.getElementById('hero-stats-subtext');
    if (el) {
      const countEl = document.getElementById('total-referrers');
      const countPart = countEl?.textContent?.trim() || '—';
      const suffix = formatHeroStatsSubtext(uniqueReferrers, leaderCount);
      el.innerHTML = `<span id="total-referrers" aria-live="polite">${countPart}</span>${people}${suffix}`;
    }
  }

  const globalLive = document.getElementById('hero-global-proof-live');
  if (globalLive) {
    globalLive.textContent = formatHeroGlobalProofLive(uniqueReferrers);
    globalLive.removeAttribute('data-i18n');
  }
}

function markLandingSegment(): void {
  const root = document.documentElement;
  if (isReferredLanding()) {
    root.removeAttribute('data-vr-direct-landing');
  } else {
    root.setAttribute('data-vr-direct-landing', '1');
  }
}

/** Sync html attrs for clarity CSS (link state, segment). */
export function refreshPublicClarityState(): void {
  markLandingSegment();
  const root = document.documentElement;
  if (hasReferralLinkInUI()) root.setAttribute('data-vr-has-link', '1');
  else root.removeAttribute('data-vr-has-link');
}

function wireNavGetLink(): void {
  const btn = document.getElementById('nav-get-link-btn');
  if (!btn || btn.dataset.vrNavBound === '1') return;
  btn.dataset.vrNavBound = '1';
  btn.addEventListener('click', () => {
    if (!hasReferralLinkInUI()) {
      const getLinkInstant = (window as unknown as { getMyReferralLinkInstant?: () => void })
        .getMyReferralLinkInstant;
      if (getLinkInstant) {
        void getLinkInstant();
        return;
      }
      const getLink = document.getElementById('hero-get-link-btn');
      if (getLink) {
        getLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
        getLink.classList.add('hero-get-link-pulse');
        window.setTimeout(() => getLink.classList.remove('hero-get-link-pulse'), 4000);
      }
      return;
    }
    const section = document.getElementById('referral-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function wireNavScrollSpy(): void {
  const nav = document.getElementById('vr-nav');
  if (!nav || nav.dataset.vrSpyBound === '1') return;
  nav.dataset.vrSpyBound = '1';

  const links = NAV_SECTIONS.map((s) => ({
    ...s,
    el: nav.querySelector<HTMLAnchorElement>(`a[href="${s.href}"]`),
    section: document.getElementById(s.id),
  })).filter((l) => l.el && l.section);

  if (!links.length) return;

  const update = () => {
    const offset = 120;
    let active = links[0]!;
    for (const link of links) {
      const top = link.section!.getBoundingClientRect().top;
      if (top - offset <= 0) active = link;
    }
    for (const link of links) {
      const on = link.id === active.id;
      link.el!.classList.toggle('vr-nav-link--active', on);
      if (on) link.el!.setAttribute('aria-current', 'location');
      else link.el!.removeAttribute('aria-current');
    }
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
}

function wireHeroLeaderboardLink(): void {
  const link = document.getElementById('hero-leaderboard-link');
  if (!link || link.dataset.vrBound === '1') return;
  link.dataset.vrBound = '1';
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/** Bootstrap public clarity (idempotent). */
export function initPublicClarity(): void {
  refreshPublicClarityState();
  wireNavGetLink();
  wireNavScrollSpy();
  wireHeroLeaderboardLink();
  initExitIntentRescue();

  window.addEventListener('vr:locale-change', () => {
    const totalEl = document.getElementById('total-referrers');
    const n = Number(String(totalEl?.textContent || '').replace(/[^\d]/g, '')) || 0;
    applyHeroStatsSubtext(n, 0);
  });
}
