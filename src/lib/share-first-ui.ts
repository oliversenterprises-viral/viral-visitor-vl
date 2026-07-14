/**
 * Share-first post–Get link UX.
 * Primary = device share sheet when available (any app the user picks).
 * Clipboard is never treated as completion for the 24h rule.
 */

import { isNativeShareSupported } from './share-power';
import { isMobileShareContext } from './share-context';
import { readShareDeadlineState } from './share-deadline';
import { t } from './i18n';

export type ShareFirstPrimary = 'native' | 'whatsapp' | 'sms';

/** Pick the best one-tap send path (not clipboard). */
export function resolveShareFirstPrimary(
  opts: { nativeSupported?: boolean; mobile?: boolean } = {},
): ShareFirstPrimary {
  const native =
    opts.nativeSupported ??
    (typeof navigator !== 'undefined' && isNativeShareSupported());
  if (native) return 'native';
  const mobile = opts.mobile ?? isMobileShareContext();
  // SMS is strong on US mobile without Web Share; WhatsApp otherwise (incl. desktop web).
  return mobile ? 'sms' : 'whatsapp';
}

/** True when local deadline state still requires a verified platform share. */
export function isSharePendingLocal(): boolean {
  const state = readShareDeadlineState();
  if (!state) {
    // Has link but no deadline yet — treat as pending until verified share or server exempt.
    return document.documentElement.hasAttribute('data-vr-has-link');
  }
  return state.status === 'pending_share' || state.status === 'unknown';
}

export function markSharePending(): void {
  document.documentElement.setAttribute('data-vr-share-pending', '1');
  document.documentElement.removeAttribute('data-vr-share-locked');
}

export function markShareLocked(): void {
  document.documentElement.removeAttribute('data-vr-share-pending');
  document.documentElement.setAttribute('data-vr-share-locked', '1');
}

export function clearShareFirstFlags(): void {
  document.documentElement.removeAttribute('data-vr-share-pending');
  document.documentElement.removeAttribute('data-vr-share-locked');
}

function primaryButtonId(primary: ShareFirstPrimary): string {
  if (primary === 'native') return 'native-share-btn';
  if (primary === 'sms') return 'share-first-sms';
  return 'share-first-whatsapp';
}

/** Label for hero / sticky CTA after link is ready. */
export function shareFirstHeroLabel(primary: ShareFirstPrimary = resolveShareFirstPrimary()): string {
  // One clear verb everywhere after get-link
  const sendNow = t('send_mode.primary_cta');
  if (sendNow) return sendNow;
  if (primary === 'native') return t('share_first.cta_native');
  if (primary === 'sms') return t('share_first.cta_sms');
  return t('share_first.cta_whatsapp');
}

/** Sync share-first strip + primary visibility after link is ready. */
export function renderShareFirstStrip(): void {
  const strip = document.getElementById('share-first-strip');
  const hasLink = !!((document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim());
  if (!hasLink) {
    strip?.classList.add('hidden');
    return;
  }

  const primary = resolveShareFirstPrimary();
  const pending = isSharePendingLocal();
  const locked = !pending && document.documentElement.hasAttribute('data-vr-share-locked');

  if (strip) {
    strip.classList.remove('hidden');
    strip.dataset.primary = primary;
    strip.dataset.status = locked ? 'locked' : 'pending';
  }

  // Prize FOMO under send path (motivates real share)
  let fomo = document.getElementById('share-first-fomo');
  if (strip && !fomo) {
    fomo = document.createElement('p');
    fomo.id = 'share-first-fomo';
    fomo.className = 'share-first-fomo text-[12px] font-semibold text-amber-200/95 mt-2 mb-1 leading-snug';
    strip.insertBefore(fomo, strip.firstChild);
  }
  if (fomo) {
    fomo.textContent = t('share_first.fomo');
    fomo.classList.toggle('hidden', locked);
  }

  // Status line
  const status = document.getElementById('share-first-status');
  if (status) {
    if (locked) {
      status.textContent = t('share_first.status_locked');
      status.dataset.status = 'locked';
    } else if (document.documentElement.hasAttribute('data-vr-confirm-dismissed')) {
      status.textContent =
        'Keep sending — locks when a friend taps Get my link. Copy never locks.';
      status.dataset.status = 'pending';
    } else {
      status.textContent = t('share_first.status_pending');
      status.dataset.status = 'pending';
    }
  }

  // Primary button highlight
  const nativeBtn = document.getElementById('native-share-btn');
  const waBtn = document.getElementById('share-first-whatsapp');
  const smsBtn = document.getElementById('share-first-sms');
  const primaryId = primaryButtonId(primary);

  for (const el of [nativeBtn, waBtn, smsBtn]) {
    if (!el) continue;
    const isPrimary = el.id === primaryId || (primary === 'native' && el.id === 'native-share-btn');
    el.classList.toggle('share-first-primary', isPrimary);
    el.classList.toggle('share-first-secondary', !isPrimary);
  }

  // Native only when supported; always show SMS + WhatsApp as alternatives
  if (nativeBtn) {
    if (isNativeShareSupported()) nativeBtn.classList.remove('hidden');
    else nativeBtn.classList.add('hidden');
  }
  waBtn?.classList.remove('hidden');
  smsBtn?.classList.remove('hidden');

  // Soft-hide grid until expanded when pending (reduce choice overload)
  const moreBtn = document.getElementById('share-more-options-btn');
  if (moreBtn && pending) moreBtn.classList.remove('hidden');

  // Keep send-mode polish if active (status / secondary collapse)
  if (document.documentElement.getAttribute('data-vr-send-mode') === '1') {
    void import('./send-mode')
      .then((m) => m.polishShareFirstForSendMode())
      .catch(() => {});
  }
}

/** Scroll to the share-first primary control. */
export function scrollToShareFirstPrimary(): void {
  const primary = resolveShareFirstPrimary();
  const id = primaryButtonId(primary);
  const run = () => {
    const el =
      document.getElementById(id) ||
      document.getElementById('share-first-strip') ||
      document.getElementById('share-buttons-panel') ||
      document.getElementById('referral-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('share-first-pulse');
    window.setTimeout(() => el?.classList.remove('share-first-pulse'), 2800);
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(run, 80);
    });
  });
}

/** Wire hero Get-link button into a one-tap share after link exists. */
export function updateHeroCtaToShareFirst(): void {
  const btn = document.getElementById('hero-get-link-btn');
  const label = btn?.querySelector('span');
  if (!btn || !label) return;

  const primary = resolveShareFirstPrimary();
  label.textContent = shareFirstHeroLabel(primary);
  btn.dataset.vrPostLinkCta = '1';
  btn.onclick = (e) => {
    e.preventDefault();
    invokeShareFirstPrimary();
  };
}

/** Click the current primary share control. */
export function invokeShareFirstPrimary(): void {
  const primary = resolveShareFirstPrimary();
  if (primary === 'native') {
    const n = document.getElementById('native-share-btn') as HTMLButtonElement | null;
    if (n && !n.classList.contains('hidden')) {
      n.click();
      return;
    }
  }
  if (primary === 'sms') {
    document.getElementById('share-first-sms')?.click() ||
      (document.querySelector('[onclick="shareTo(\'sms\')"]') as HTMLElement | null)?.click();
    return;
  }
  document.getElementById('share-first-whatsapp')?.click() ||
    document.getElementById('share-whatsapp-primary')?.click();
}

/**
 * After Get link: full send-mode UX (one primary action, less chrome).
 * Delegates to send-mode so every entry point stays bulletproof.
 */
export function activateShareFirstAfterGetLink(opts?: { autoCopied?: boolean }): void {
  void import('./send-mode')
    .then((m) => m.activateSendModeAfterGetLink(opts))
    .catch(() => {
      // Fallback if send-mode fails to load — still mark pending + show strip
      markSharePending();
      document.documentElement.setAttribute('data-vr-send-mode', '1');
      document.documentElement.removeAttribute('data-vr-slim-share-expanded');
      renderShareFirstStrip();
      updateHeroCtaToShareFirst();
      scrollToShareFirstPrimary();
    });
}

/** Call when first real referral locks the link. */
export function onVerifiedShareForShareFirst(): void {
  markShareLocked();
  document.documentElement.removeAttribute('data-vr-send-mode');
  document.documentElement.removeAttribute('data-vr-send-more');
  void import('./send-mode')
    .then((m) => m.exitSendMode())
    .catch(() => {});
  renderShareFirstStrip();
  void import('./share-deadline').then((m) => m.renderShareDeadlineBanner());
  void import('./post-share-return')
    .then((m) => m.activatePostShareReturnLoop())
    .catch(() => {});
}
