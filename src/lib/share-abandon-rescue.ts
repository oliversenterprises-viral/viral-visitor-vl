/**
 * Share abandon rescue — make post–get-link sharing hard to ignore or skip.
 *
 * When a visitor has a link but has not locked it (friend Get my link),
 * intercept leave/idle paths with a high-attention panel that funnels
 * them back to the primary send action.
 *
 * White-hat: no dark patterns that trap forever; limited soft dismisses
 * per session; never blocks accessibility or breaks locked/embed flows.
 * Residual-risk mitigations: longer dwell, fewer shows, poll only when
 * send strip is off-screen, beforeunload only after a prior prompt, Escape
 * + (after first show) backdrop soft-dismiss.
 */

import { isEmbedMode } from './embed-mode';
import { isSharePendingLocal } from './share-first-ui';
import { t } from './i18n';

const SESSION_SHOWS_KEY = 'vr_share_abandon_shows';
const SESSION_SNOOZE_KEY = 'vr_share_abandon_snooze';
const PANEL_ID = 'vr-share-abandon';

/** Soft dwell before first abandon prompt (desktop). */
export const MIN_DWELL_MS = 12_000;
/** Mobile dwell without a send attempt. */
export const MOBILE_DWELL_MS = 25_000;
/** Soft snooze after "I'll send later" / Escape / backdrop (after first). */
export const SOFT_SNOOZE_MS = 5 * 60 * 1000;
/** Max full panels per tab session (kept low to avoid fatigue). */
export const MAX_SESSION_SHOWS = 3;
/** Re-check interval while pending (only if strip off-screen). */
export const POLL_MS = 90_000;
/** Min time away before return-prompt. */
export const MIN_AWAY_RETURN_MS = 10_000;
/** Min session age before beforeunload arms (even without a prior panel). */
export const BEFOREUNLOAD_MIN_DWELL_MS = 90_000;

export interface ShareAbandonEligibility {
  hasLink: boolean;
  sharePending: boolean;
  locked: boolean;
  alreadyMaxShows: boolean;
  snoozed: boolean;
  dwellMs: number;
  isCoarsePointer: boolean;
  embed: boolean;
  confirmFlowActive: boolean;
  /** Poll path only: skip if primary send UI is already visible. */
  shareStripInView?: boolean;
  reason?: string;
  /** Paid / Reddit — prompt share sooner after get-link. */
  isPaidTraffic?: boolean;
}

/** Dwell before share-abandon panel (paid traffic is faster). */
export function resolveShareAbandonDwellMs(opts: {
  isCoarsePointer: boolean;
  isPaidTraffic?: boolean;
}): number {
  if (opts.isPaidTraffic) {
    return opts.isCoarsePointer ? 10_000 : 6_000;
  }
  return opts.isCoarsePointer ? MOBILE_DWELL_MS : MIN_DWELL_MS;
}

/** Send screen is up — never cover Copy link / Send it now. */
export function isPostLinkSendScreenActive(doc: Document = document): boolean {
  if (doc.documentElement.hasAttribute('data-vr-post-link-one')) return true;
  const share = doc.getElementById('post-link-share');
  if (share && !share.hidden && share.getAttribute('data-state') === 'ready') return true;
  return false;
}

export function shouldShowShareAbandon(opts: ShareAbandonEligibility): boolean {
  if (isPostLinkSendScreenActive()) return false;
  if (opts.embed || opts.locked || !opts.hasLink || !opts.sharePending) return false;
  if (opts.alreadyMaxShows || opts.snoozed || opts.confirmFlowActive) return false;
  // Poll is the softest path — never interrupt if they can already see Send
  if (opts.reason === 'poll' && opts.shareStripInView) return false;
  const need = resolveShareAbandonDwellMs({
    isCoarsePointer: opts.isCoarsePointer,
    isPaidTraffic: opts.isPaidTraffic,
  });
  return opts.dwellMs >= need;
}

/** beforeunload only after a prior abandon prompt, or long idle pending. */
export function shouldArmBeforeUnload(opts: {
  hasLink: boolean;
  sharePending: boolean;
  locked: boolean;
  embed: boolean;
  confirmFlowActive: boolean;
  snoozed: boolean;
  sessionShows: number;
  dwellMs: number;
}): boolean {
  if (opts.embed || opts.locked || !opts.hasLink || !opts.sharePending) return false;
  if (opts.confirmFlowActive || opts.snoozed) return false;
  if (opts.sessionShows >= 1) return true;
  return opts.dwellMs >= BEFOREUNLOAD_MIN_DWELL_MS;
}

export function buildShareAbandonMessage(): {
  title: string;
  body: string;
  cta: string;
  later: string;
} {
  return {
    title: t('share_abandon.title'),
    body: t('share_abandon.body'),
    cta: t('share_abandon.cta'),
    later: t('share_abandon.later'),
  };
}

function sessionShows(): number {
  try {
    const n = parseInt(sessionStorage.getItem(SESSION_SHOWS_KEY) || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function bumpShows(): void {
  try {
    sessionStorage.setItem(SESSION_SHOWS_KEY, String(sessionShows() + 1));
  } catch {
    /* non-fatal */
  }
}

function isSnoozed(now = Date.now()): boolean {
  try {
    const until = parseInt(sessionStorage.getItem(SESSION_SNOOZE_KEY) || '0', 10);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function softSnoozeShareAbandon(ms = SOFT_SNOOZE_MS, now = Date.now()): void {
  try {
    sessionStorage.setItem(SESSION_SNOOZE_KEY, String(now + ms));
  } catch {
    /* non-fatal */
  }
}

function hasLink(): boolean {
  return (
    document.documentElement.hasAttribute('data-vr-has-link') ||
    !!(document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim()
  );
}

function isLocked(): boolean {
  return document.documentElement.hasAttribute('data-vr-share-locked');
}

function confirmFlowActive(): boolean {
  const banner = document.getElementById('share-confirm-banner');
  if (banner && !banner.classList.contains('hidden')) return true;
  return document.documentElement.hasAttribute('data-vr-share-confirm');
}

/** True when share-first / sticky send is largely in the viewport. */
export function isShareStripInView(win: Window = window): boolean {
  const el =
    win.document.getElementById('share-first-strip') ||
    win.document.getElementById('mobile-send-cta') ||
    win.document.getElementById('native-share-btn');
  if (!el) return false;
  if (el.classList.contains('hidden')) {
    // sticky may be the only visible path
    const sticky = win.document.getElementById('mobile-send-cta');
    if (!sticky || sticky.classList.contains('hidden')) return false;
    return stickyInViewport(sticky, win);
  }
  return stickyInViewport(el, win);
}

function stickyInViewport(el: Element, win: Window): boolean {
  try {
    const r = el.getBoundingClientRect();
    const vh = win.innerHeight || 0;
    if (r.height <= 0 && r.width <= 0) return false;
    // At least ~40% of the control is visible
    const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return visible >= Math.min(r.height * 0.4, 48);
  } catch {
    return false;
  }
}

function removePanel(): void {
  document.getElementById(PANEL_ID)?.remove();
  document.documentElement.removeAttribute('data-vr-share-abandon');
}

/** Copy / Send must win — drop the overlay immediately. */
export function dismissShareAbandon(): void {
  removePanel();
}

const SEND_CONTROL_IDS = ['post-link-copy', 'post-link-primary'] as const;

/** True when the pointer is over Copy link or Send it now. */
export function sendControlUnderPoint(
  clientX: number,
  clientY: number,
  doc: Document = document,
): HTMLElement | null {
  for (const id of SEND_CONTROL_IDS) {
    const el = doc.getElementById(id);
    if (!el || el.hidden || el.classList.contains('hidden')) continue;
    const r = el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return el;
    }
  }
  return null;
}

/**
 * Capture-phase: if the Don't-leave overlay is sitting on Copy / Send,
 * drop it and replay the tap onto the real control. Copy must win first tap.
 */
export function stealShareAbandonIfSendTap(ev: Event): boolean {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return false;

  const target = ev.target;
  if (target instanceof Element && target.closest('#post-link-copy, #post-link-primary')) {
    removePanel();
    return true;
  }

  let hit: HTMLElement | null = null;
  if (ev instanceof PointerEvent || ev instanceof MouseEvent) {
    hit = sendControlUnderPoint(ev.clientX, ev.clientY);
  }

  if (!hit && !isPostLinkSendScreenActive()) return false;

  removePanel();

  if (hit && (target === panel || (target instanceof Node && panel.contains(target)))) {
    ev.preventDefault();
    ev.stopPropagation();
    hit.click();
  }
  return true;
}

function invokeSend(): void {
  try {
    sessionStorage.setItem('vr_get_link_via', 'share_abandon_rescue');
  } catch {
    /* non-fatal */
  }
  const g = window as Window & { invokeShareFirstPrimary?: () => void };
  if (typeof g.invokeShareFirstPrimary === 'function') {
    g.invokeShareFirstPrimary();
    return;
  }
  void import('./share-first-ui')
    .then((m) => m.invokeShareFirstPrimary())
    .catch(() => {
      const el =
        document.getElementById('native-share-btn') ||
        document.getElementById('share-first-sms') ||
        document.getElementById('share-first-whatsapp');
      el?.click();
    });
}

function showAbandonPanel(reason: string): void {
  if (document.getElementById(PANEL_ID)) return;
  if (
    !shouldShowShareAbandon({
      hasLink: hasLink(),
      sharePending: isSharePendingLocal(),
      locked: isLocked(),
      alreadyMaxShows: sessionShows() >= MAX_SESSION_SHOWS,
      snoozed: isSnoozed(),
      dwellMs: Number.MAX_SAFE_INTEGER,
      isCoarsePointer: false,
      embed: isEmbedMode(),
      confirmFlowActive: confirmFlowActive(),
      shareStripInView: reason === 'poll' ? isShareStripInView() : false,
      reason,
      isPaidTraffic: document.documentElement.getAttribute('data-vr-paid-landing') === '1',
    })
  ) {
    return;
  }

  const copy = buildShareAbandonMessage();
  const priorShows = sessionShows();
  // After the first panel in a session, allow backdrop / Escape soft-exit (less trap-y)
  const allowSoftBackdrop = priorShows >= 1;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'vr-share-abandon';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'vr-share-abandon-title');
  panel.dataset.reason = reason;
  panel.innerHTML = `
    <div class="vr-share-abandon-backdrop" data-abandon-backdrop></div>
    <div class="vr-share-abandon-card" tabindex="-1">
      <div class="vr-share-abandon-pulse" aria-hidden="true"></div>
      <p id="vr-share-abandon-title" class="vr-share-abandon-title">${copy.title}</p>
      <p class="vr-share-abandon-body">${copy.body}</p>
      <div class="vr-share-abandon-actions">
        <button type="button" class="vr-share-abandon-cta" data-abandon-cta>
          <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          ${copy.cta}
        </button>
        <button type="button" class="vr-share-abandon-later" data-abandon-later>${copy.later}</button>
      </div>
      <p class="vr-share-abandon-rule">${t('rule.public')}</p>
    </div>
  `;

  document.body.appendChild(panel);
  document.documentElement.setAttribute('data-vr-share-abandon', reason);
  bumpShows();

  const closeSoft = () => {
    softSnoozeShareAbandon();
    removePanel();
    window.removeEventListener('keydown', onKey);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSoft();
    }
  };
  window.addEventListener('keydown', onKey);

  panel.querySelector('[data-abandon-cta]')?.addEventListener('click', () => {
    window.removeEventListener('keydown', onKey);
    removePanel();
    // Brief snooze so re-open mid-sheet doesn't stack
    softSnoozeShareAbandon(60_000);
    invokeSend();
  });
  panel.querySelector('[data-abandon-later]')?.addEventListener('click', closeSoft);

  panel.querySelector('[data-abandon-backdrop]')?.addEventListener('click', () => {
    if (allowSoftBackdrop) {
      closeSoft();
      return;
    }
    // First show: nudge only (still hard to skip once)
    panel.querySelector<HTMLElement>('.vr-share-abandon-card')?.classList.add('vr-share-abandon-shake');
    window.setTimeout(() => {
      panel.querySelector('.vr-share-abandon-card')?.classList.remove('vr-share-abandon-shake');
    }, 420);
  });

  // Focus primary for a11y
  window.setTimeout(() => {
    (panel.querySelector('[data-abandon-cta]') as HTMLElement | null)?.focus();
  }, 50);
}

function tryShow(reason: string, startedAt: number, coarse: boolean): void {
  if (document.getElementById(PANEL_ID)) return;
  if (
    !shouldShowShareAbandon({
      hasLink: hasLink(),
      sharePending: isSharePendingLocal(),
      locked: isLocked(),
      alreadyMaxShows: sessionShows() >= MAX_SESSION_SHOWS,
      snoozed: isSnoozed(),
      dwellMs: Date.now() - startedAt,
      isCoarsePointer: coarse,
      embed: isEmbedMode(),
      confirmFlowActive: confirmFlowActive(),
      shareStripInView: reason === 'poll' ? isShareStripInView() : false,
      reason,
      isPaidTraffic: document.documentElement.getAttribute('data-vr-paid-landing') === '1',
    })
  ) {
    return;
  }
  showAbandonPanel(reason);
}

/** Browser leave dialog — only after prior prompt or long idle (mitigates surprise). */
function makeBeforeUnloadHandler(startedAt: number) {
  return (e: BeforeUnloadEvent): void => {
    if (
      !shouldArmBeforeUnload({
        hasLink: hasLink(),
        sharePending: isSharePendingLocal(),
        locked: isLocked(),
        embed: isEmbedMode(),
        confirmFlowActive: confirmFlowActive(),
        snoozed: isSnoozed(),
        sessionShows: sessionShows(),
        dwellMs: Date.now() - startedAt,
      })
    ) {
      return;
    }
    e.preventDefault();
    e.returnValue = '';
  };
}

/**
 * Bootstrap abandon rescue (idempotent).
 * Call after get-link / send-mode, and on return visits with pending share.
 */
export function initShareAbandonRescue(win: Window = window): void {
  if (isEmbedMode(win.location) || win.document.documentElement.dataset.vrShareAbandonBound === '1') {
    return;
  }
  win.document.documentElement.dataset.vrShareAbandonBound = '1';

  const started = Date.now();
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  const isPaid =
    win.document.documentElement.getAttribute('data-vr-paid-landing') === '1';
  const dwellNeed = resolveShareAbandonDwellMs({
    isCoarsePointer: coarse,
    isPaidTraffic: isPaid,
  });
  let leftHiddenAt: number | null = null;

  if (!coarse) {
    win.document.addEventListener('mouseout', (e: MouseEvent) => {
      if (e.clientY > 12 || e.relatedTarget != null) return;
      tryShow('exit', started, coarse);
    });
    if (isPaid) {
      win.setTimeout(() => tryShow('dwell', started, coarse), dwellNeed);
    }
  } else {
    win.setTimeout(() => tryShow('dwell', started, coarse), dwellNeed);
  }

  win.document.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState === 'hidden') {
      leftHiddenAt = Date.now();
      return;
    }
    if (leftHiddenAt != null && Date.now() - leftHiddenAt >= MIN_AWAY_RETURN_MS) {
      tryShow('return', started, coarse);
    }
    leftHiddenAt = null;
  });

  win.addEventListener('beforeunload', makeBeforeUnloadHandler(started));

  // Periodic re-surface only if they scrolled away from send UI
  win.setInterval(() => {
    if (!hasLink() || isLocked() || !isSharePendingLocal() || isPostLinkSendScreenActive()) {
      removePanel();
      return;
    }
    tryShow('poll', started, coarse);
  }, POLL_MS);

  win.document.addEventListener('pointerdown', stealShareAbandonIfSendTap, true);

  // Clear panel when locked, or when the send screen is up (Copy must win)
  const obs = new MutationObserver(() => {
    if (isLocked() || !isSharePendingLocal() || isPostLinkSendScreenActive()) removePanel();
  });
  obs.observe(win.document.documentElement, {
    attributes: true,
    attributeFilter: [
      'data-vr-share-locked',
      'data-vr-share-pending',
      'data-vr-has-link',
      'data-vr-post-link-one',
    ],
  });
}

/** Force show (tests / debug). Respects eligibility. */
export function forceShareAbandonForTest(reason = 'test'): void {
  showAbandonPanel(reason);
}

export function resetShareAbandonSessionForTest(): void {
  try {
    sessionStorage.removeItem(SESSION_SHOWS_KEY);
    sessionStorage.removeItem(SESSION_SNOOZE_KEY);
  } catch {
    /* ignore */
  }
  removePanel();
  if (typeof document !== 'undefined') {
    delete document.documentElement.dataset.vrShareAbandonBound;
  }
}
