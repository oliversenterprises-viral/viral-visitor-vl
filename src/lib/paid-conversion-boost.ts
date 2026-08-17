/**
 * Paid / Reddit cold-traffic conversion boost.
 *
 * Real problem this solves: paid landings (esp. Reddit) produce SiteLanding
 * but ~0 GetReferralLink / ShareReferral. Visitors bounce in a few seconds;
 * default mobile dwell rescue (22s) is too slow and hero copy is generic.
 *
 * White-hat only: stronger clarity + faster soft prompts — no auto-click,
 * no fake shares, no dark patterns that trap the user.
 */

import { isEmbedMode } from './embed-mode';
import { isReferredLanding, highlightHeroGetLink } from './funnel-conversion';
import { getStoredUtmAttribution } from './utm-attribution';
import { hasReferralLinkInUI } from './visitor-slim';

const PAID_ATTR = 'data-vr-paid-landing';
const NUDGE_SESSION_KEY = 'vr_paid_nudge_shown';

/** Mobile dwell before soft get-link panel on paid traffic (default exit rescue is 22s). */
export const PAID_MOBILE_DWELL_MS = 6_000;
/** Desktop dwell before soft panel if they never hit the hero CTA. */
export const PAID_DESKTOP_DWELL_MS = 8_000;

export interface PaidTrafficSignals {
  utmSource: string | null;
  utmMedium: string | null;
  referrer: string;
  userAgent: string;
}

/** True when this session looks like paid ads or Reddit cold traffic. */
export function isPaidOrRedditTraffic(signals: PaidTrafficSignals): boolean {
  const src = String(signals.utmSource || '')
    .trim()
    .toLowerCase();
  const med = String(signals.utmMedium || '')
    .trim()
    .toLowerCase();
  const ref = String(signals.referrer || '').toLowerCase();
  const ua = String(signals.userAgent || '');

  if (src === 'reddit') return true;
  if (med === 'paid' || med === 'cpc' || med === 'cpm' || med === 'ppc') return true;
  if (src && (src.includes('reddit') || src === 'ads' || src === 'ad')) return true;
  if (/reddit\.com|redd\.it/.test(ref)) return true;
  // Reddit in-app browser often embeds "Reddit" in UA
  if (/\bReddit\b/i.test(ua)) return true;

  return false;
}

export function resolvePaidTrafficSignals(
  loc: Location = typeof location !== 'undefined' ? location : ({} as Location),
  win: Window = typeof window !== 'undefined' ? window : ({} as Window),
): PaidTrafficSignals {
  const utm = getStoredUtmAttribution();
  const search = (() => {
    try {
      return loc.search || '';
    } catch {
      return '';
    }
  })();
  const params = search ? new URLSearchParams(search) : null;

  return {
    utmSource: utm?.source ?? params?.get('utm_source') ?? null,
    utmMedium: utm?.medium ?? params?.get('utm_medium') ?? null,
    referrer: (() => {
      try {
        return win.document?.referrer || '';
      } catch {
        return '';
      }
    })(),
    userAgent: (() => {
      try {
        return win.navigator?.userAgent || '';
      } catch {
        return '';
      }
    })(),
  };
}

function alreadyNudged(): boolean {
  try {
    return sessionStorage.getItem(NUDGE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markNudged(): void {
  try {
    sessionStorage.setItem(NUDGE_SESSION_KEY, '1');
  } catch {
    /* non-fatal */
  }
}

function triggerGetLink(via: string): void {
  try {
    sessionStorage.setItem('vr_get_link_via', via);
  } catch {
    /* non-fatal */
  }
  const fn = (window as Window & { getMyReferralLinkInstant?: () => void | Promise<void> })
    .getMyReferralLinkInstant;
  if (typeof fn === 'function') {
    void fn();
    return;
  }
  document.getElementById('hero-get-link-btn')?.click();
}

/** Force sticky mobile Step-1 bar visible for paid landers without a link. */
export function forceMobileGetLinkBar(): void {
  const bar = document.getElementById('mobile-referral-cta');
  if (!bar || hasReferralLinkInUI()) return;
  bar.classList.remove('hidden');
  const label = bar.querySelector('span');
  if (label) label.textContent = 'Get my referral link — then share';
}

function scrollHeroCtaIntoView(): void {
  const btn = document.getElementById('hero-get-link-btn');
  if (!btn) return;
  try {
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    /* ignore */
  }
  highlightHeroGetLink();
}

function showPaidGetLinkNudge(): void {
  if (alreadyNudged() || hasReferralLinkInUI() || isReferredLanding()) return;
  if (document.getElementById('vr-paid-getlink-nudge')) return;

  markNudged();
  const panel = document.createElement('div');
  panel.id = 'vr-paid-getlink-nudge';
  panel.className = 'vr-paid-getlink-nudge';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'vr-paid-nudge-title');
  panel.innerHTML = `
    <div class="vr-paid-getlink-nudge-card">
      <button type="button" class="vr-paid-getlink-nudge-close" aria-label="Dismiss">&times;</button>
      <p id="vr-paid-nudge-title" class="vr-paid-getlink-nudge-title">One tap to get your link</p>
      <p class="vr-paid-getlink-nudge-body">Free · no signup. Get your unique link, share it once, climb the live board.</p>
      <button type="button" class="vr-paid-getlink-nudge-cta">Get my referral link now</button>
      <button type="button" class="vr-paid-getlink-nudge-dismiss">Not now</button>
    </div>
  `;
  document.body.appendChild(panel);
  document.documentElement.setAttribute('data-vr-paid-nudge', '1');

  const dismiss = () => {
    panel.remove();
    document.documentElement.removeAttribute('data-vr-paid-nudge');
  };
  panel.querySelector('.vr-paid-getlink-nudge-close')?.addEventListener('click', dismiss);
  panel.querySelector('.vr-paid-getlink-nudge-dismiss')?.addEventListener('click', dismiss);
  panel.querySelector('.vr-paid-getlink-nudge-cta')?.addEventListener('click', () => {
    triggerGetLink('paid_nudge');
    dismiss();
  });
}

/**
 * Apply paid/Reddit conversion mode (idempotent).
 * Call after UTM capture + public bootstrap.
 */
export function initPaidConversionBoost(
  loc: Location = location,
  win: Window = window,
): boolean {
  if (isEmbedMode(loc)) return false;
  if (isReferredLanding(loc)) return false;
  if (hasReferralLinkInUI()) return false;

  const signals = resolvePaidTrafficSignals(loc, win);
  if (!isPaidOrRedditTraffic(signals)) return false;

  const root = win.document.documentElement;
  if (root.getAttribute(PAID_ATTR) === '1' && root.dataset.vrPaidBoostBound === '1') {
    return true;
  }
  root.setAttribute(PAID_ATTR, '1');
  root.dataset.vrPaidBoostBound = '1';

  // Immediate conversion surface
  forceMobileGetLinkBar();
  highlightHeroGetLink();
  win.setTimeout(() => scrollHeroCtaIntoView(), 350);

  const coarse = (() => {
    try {
      return win.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  })();
  const dwell = coarse ? PAID_MOBILE_DWELL_MS : PAID_DESKTOP_DWELL_MS;

  win.setTimeout(() => {
    if (hasReferralLinkInUI()) return;
    forceMobileGetLinkBar();
    showPaidGetLinkNudge();
  }, dwell);

  // Re-assert sticky bar on resize (orientation) while no link
  win.addEventListener(
    'resize',
    () => {
      if (!hasReferralLinkInUI()) forceMobileGetLinkBar();
    },
    { passive: true },
  );

  return true;
}
