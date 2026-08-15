/**
 * Bulletproof post–get-link "send mode":
 * one job — send the link to a friend now. Everything else stays out of the way.
 */

import { registerGlobal } from './global';
import {
  invokeShareFirstPrimary,
  isSharePendingLocal,
  markSharePending,
  resolveShareFirstPrimary,
  shareFirstHeroLabel,
} from './share-first-ui';
import { t } from './i18n';
import { activatePostLinkShare } from './post-link-share';

const SEND_MODE_ATTR = 'data-vr-send-mode';
const STICKY_ID = 'mobile-send-cta';

export function isSendModeActive(): boolean {
  return document.documentElement.getAttribute(SEND_MODE_ATTR) === '1';
}

export function enterSendMode(): void {
  document.documentElement.setAttribute(SEND_MODE_ATTR, '1');
  document.documentElement.removeAttribute('data-vr-slim-share-expanded');
  document.documentElement.removeAttribute('data-vr-send-more');
  markSharePending();
  // Force visitor-slim so extra platforms stay collapsed
  document.documentElement.setAttribute('data-vr-visitor-slim', '1');
}

export function exitSendMode(): void {
  document.documentElement.removeAttribute(SEND_MODE_ATTR);
  document.documentElement.removeAttribute('data-vr-send-more');
  document.documentElement.removeAttribute('data-vr-post-get-link');
  hideStickySendBar();
  document.getElementById('share-first-strip')?.classList.remove('share-first-strip--send-mode');
}

function ensureStickySendBar(): HTMLElement {
  let bar = document.getElementById(STICKY_ID);
  if (bar) return bar;

  bar = document.createElement('div');
  bar.id = STICKY_ID;
  bar.className =
    'mobile-send-cta fixed inset-x-0 bottom-0 z-[820] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-zinc-950/97 border-t border-emerald-400/30 backdrop-blur-md hidden';
  bar.innerHTML = `
    <button type="button" id="mobile-send-cta-btn"
      class="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl font-bold text-base text-white
             bg-gradient-to-r from-emerald-600 to-violet-600 hover:from-emerald-500 hover:to-violet-500
             shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-300/35 active:scale-[0.99] transition">
      <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
      <span data-mobile-send-label>Send to a friend now</span>
    </button>
    <p class="text-[10px] text-center text-zinc-400 mt-1.5 leading-snug" data-mobile-send-hint>
      A friend must open your link and tap Get my link
    </p>`;
  document.body.appendChild(bar);

  bar.querySelector('#mobile-send-cta-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    invokeShareFirstPrimary();
  });

  return bar;
}

export function showStickySendBar(): void {
  const bar = ensureStickySendBar();
  const primary = resolveShareFirstPrimary();
  const label = bar.querySelector<HTMLElement>('[data-mobile-send-label]');
  if (label) {
    label.textContent = t('send_mode.sticky_cta');
  }
  const hint = bar.querySelector<HTMLElement>('[data-mobile-send-hint]');
  if (hint) {
    hint.textContent = t('send_mode.sticky_hint');
  }
  // Subtle primary channel hint on the button title
  const btn = bar.querySelector<HTMLButtonElement>('#mobile-send-cta-btn');
  if (btn) {
    btn.title =
      primary === 'native'
        ? 'Open share sheet — pick any app'
        : primary === 'sms'
          ? 'Send by text'
          : 'Send on WhatsApp';
  }
  bar.classList.remove('hidden');
  document.body.classList.add('has-mobile-send-cta');
}

export function hideStickySendBar(): void {
  document.getElementById(STICKY_ID)?.classList.add('hidden');
  document.body.classList.remove('has-mobile-send-cta');
}

/** Polish share-first strip for send mode (one giant primary). */
export function polishShareFirstForSendMode(): void {
  const strip = document.getElementById('share-first-strip');
  if (!strip) return;

  strip.classList.add('share-first-strip--send-mode');

  // Big primary label
  const nativeSpan = document.querySelector('#native-share-btn span');
  const primary = resolveShareFirstPrimary();
  const sendLabel = t('send_mode.primary_cta');
  if (nativeSpan && primary === 'native') {
    nativeSpan.textContent = sendLabel;
  }

  // Status / sub — crystal clear
  const status = document.getElementById('share-first-status');
  if (status && isSharePendingLocal()) {
    status.textContent = t('send_mode.status');
    status.dataset.status = 'pending';
  }
  const sub = strip.querySelector<HTMLElement>('[data-i18n="share_first.sub"]');
  if (sub) {
    sub.textContent = t('send_mode.sub');
  }
  const heading = strip.querySelector<HTMLElement>('[data-i18n="share_first.heading"]');
  if (heading) {
    heading.textContent = t('send_mode.primary_cta');
  }

  // First session: no SMS, no platform pack, no More door.
  const altGrid = strip.querySelector('.grid.grid-cols-2');
  if (altGrid instanceof HTMLElement) {
    altGrid.dataset.vrSendSecondary = '1';
    altGrid.classList.add('hidden');
  }
  document.getElementById('share-first-sms')?.classList.add('hidden');
  document.getElementById('share-more-options-btn')?.classList.add('hidden');
  document.getElementById('kid-more-tools-btn')?.classList.add('hidden');
  const existingMore = document.getElementById('send-mode-more-btn');
  existingMore?.classList.add('hidden');
  existingMore?.setAttribute('hidden', '');

  const copyOnly = strip.querySelector('.share-first-copy-only');
  if (copyOnly instanceof HTMLElement) copyOnly.classList.add('hidden');

  const nativeBtn = document.getElementById('native-share-btn');
  const waBtn = document.getElementById('share-first-whatsapp');
  if (primary !== 'native' && (!nativeBtn || nativeBtn.classList.contains('hidden')) && waBtn) {
    const grid = strip.querySelector('[data-vr-send-secondary]');
    if (grid instanceof HTMLElement) grid.classList.remove('hidden');
    waBtn.classList.add('share-first-primary-btn', 'col-span-2');
    waBtn.classList.remove('share-first-alt-btn', 'hidden');
    const span = waBtn.querySelector('span');
    if (span) span.textContent = sendLabel;
  }
}

/**
 * Leftover entry from older Get-my-link callers.
 * First session is Lumina's one-action screen — never enter send-mode.
 */
export function activateSendModeAfterGetLink(_opts?: { autoCopied?: boolean }): void {
  const link =
    (document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim() || '';
  if (link) activatePostLinkShare(link);
  document.getElementById('share-first-strip')?.classList.add('hidden');
  document.getElementById('share-more-options-btn')?.classList.add('hidden');
  document.getElementById('kid-more-tools-btn')?.classList.add('hidden');
  document.getElementById('send-mode-more-btn')?.classList.add('hidden');
  hideStickySendBar();
}

registerGlobal('invokeShareFirstPrimary', invokeShareFirstPrimary);
registerGlobal('activateSendModeAfterGetLink', activateSendModeAfterGetLink);

// re-export for callers that used share-first entry
export { shareFirstHeroLabel };
