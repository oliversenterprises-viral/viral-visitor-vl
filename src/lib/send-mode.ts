/**
 * Bulletproof post–get-link "send mode":
 * one job — send the link to a friend now. Everything else stays out of the way.
 */

import { registerGlobal } from './global';
import {
  invokeShareFirstPrimary,
  isSharePendingLocal,
  markSharePending,
  renderShareFirstStrip,
  resolveShareFirstPrimary,
  scrollToShareFirstPrimary,
  shareFirstHeroLabel,
  updateHeroCtaToShareFirst,
} from './share-first-ui';
import { t } from './i18n';

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

  // Hide secondary row behind "More ways" until expanded
  const altGrid = strip.querySelector('.grid.grid-cols-2');
  if (altGrid instanceof HTMLElement) {
    altGrid.dataset.vrSendSecondary = '1';
    if (!document.documentElement.hasAttribute('data-vr-send-more')) {
      altGrid.classList.add('hidden');
    } else {
      altGrid.classList.remove('hidden');
    }
  }
  const copyOnly = strip.querySelector('.share-first-copy-only');
  if (copyOnly instanceof HTMLElement) {
    copyOnly.classList.toggle('hidden', !document.documentElement.hasAttribute('data-vr-send-more'));
  }

  let more = document.getElementById('send-mode-more-btn') as HTMLButtonElement | null;
  if (!more) {
    more = document.createElement('button');
    more.id = 'send-mode-more-btn';
    more.type = 'button';
    more.className =
      'send-mode-more-btn w-full text-center text-xs font-semibold text-zinc-400 hover:text-zinc-200 py-2';
    more.addEventListener('click', () => {
      const root = document.documentElement;
      if (root.hasAttribute('data-vr-send-more')) {
        root.removeAttribute('data-vr-send-more');
        more!.textContent = t('send_mode.more');
      } else {
        root.setAttribute('data-vr-send-more', '1');
        more!.textContent = t('send_mode.less');
      }
      polishShareFirstForSendMode();
    });
    const actions = strip.querySelector('.flex.flex-col.gap-2');
    actions?.appendChild(more);
  }
  more.textContent = document.documentElement.hasAttribute('data-vr-send-more')
    ? t('send_mode.less')
    : t('send_mode.more');

  // If no native, promote SMS/WhatsApp as the single visible primary
  const nativeBtn = document.getElementById('native-share-btn');
  const smsBtn = document.getElementById('share-first-sms');
  const waBtn = document.getElementById('share-first-whatsapp');
  if (primary !== 'native' && (!nativeBtn || nativeBtn.classList.contains('hidden'))) {
    // Show the alt grid with primary highlighted
    const grid = strip.querySelector('[data-vr-send-secondary]');
    if (grid instanceof HTMLElement) grid.classList.remove('hidden');
    if (primary === 'sms' && smsBtn) {
      smsBtn.classList.add('share-first-primary-btn', 'col-span-2');
      smsBtn.classList.remove('share-first-alt-btn');
      const span = smsBtn.querySelector('span');
      if (span) span.textContent = sendLabel;
      waBtn?.classList.add('hidden');
    }
    if (primary === 'whatsapp' && waBtn) {
      waBtn.classList.add('share-first-primary-btn', 'col-span-2');
      waBtn.classList.remove('share-first-alt-btn');
      const span = waBtn.querySelector('span');
      if (span) span.textContent = sendLabel;
      smsBtn?.classList.add('hidden');
    }
  }
}

/**
 * Full activation after Get my link — the only conversion moment that matters.
 */
export function activateSendModeAfterGetLink(opts?: { autoCopied?: boolean }): void {
  enterSendMode();
  renderShareFirstStrip();
  polishShareFirstForSendMode();
  updateHeroCtaToShareFirst();

  // Hero label: always "Send to a friend now" in send mode
  const sendLabel = t('send_mode.primary_cta');
  const heroBtn = document.getElementById('hero-get-link-btn');
  const heroLabel = heroBtn?.querySelector('span');
  if (heroLabel) {
    heroLabel.textContent = sendLabel;
  }
  // Sticky nav get-link also retargets when present
  const navBtn = document.getElementById('nav-get-link-btn');
  if (navBtn) {
    navBtn.textContent = sendLabel;
    navBtn.onclick = (e) => {
      e.preventDefault();
      invokeShareFirstPrimary();
    };
  }

  const hint = document.getElementById('referral-next-step');
  if (hint) {
    hint.classList.remove('hidden');
    hint.dataset.vrSharePrompted = '1';
    hint.textContent = t('send_mode.next_step');
  }

  // Share-reminder strip (if mounted)
  const reminderText = document.querySelector<HTMLElement>('[data-share-reminder-text]');
  if (reminderText) {
    reminderText.textContent = t('send_mode.reminder');
  }
  const reminderAction = document.getElementById('share-reminder-action');
  if (reminderAction) {
    reminderAction.textContent = sendLabel;
    reminderAction.onclick = (e) => {
      e.preventDefault();
      invokeShareFirstPrimary();
    };
  }

  showStickySendBar();
  scrollToShareFirstPrimary();

  // Re-sync funnel guide after strip is visible (ring was skipped while strip was hidden)
  void import('./funnel-conversion')
    .then((m) => m.setFunnelStep(3))
    .catch(() => {});

  // Pulse primary hard
  window.setTimeout(() => {
    const primary = resolveShareFirstPrimary();
    const id =
      primary === 'native'
        ? 'native-share-btn'
        : primary === 'sms'
          ? 'share-first-sms'
          : 'share-first-whatsapp';
    document.getElementById(id)?.classList.add('share-first-pulse');
    document.getElementById('mobile-send-cta-btn')?.classList.add('share-first-pulse');
  }, 200);

  void opts; // reserved (autoCopied is informational for future analytics)
}

registerGlobal('invokeShareFirstPrimary', invokeShareFirstPrimary);
registerGlobal('activateSendModeAfterGetLink', activateSendModeAfterGetLink);

// re-export for callers that used share-first entry
export { shareFirstHeroLabel };
