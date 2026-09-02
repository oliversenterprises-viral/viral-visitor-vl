/**
 * Lumina first-session post–Get my link screen.
 * One share action. No more-door, no command center, no platform grid.
 */

import { registerGlobal } from './global';
import { LOCKED_SHARE_TEXT } from './prize-slot';
import { SEND_NOW_LABEL } from './referred-race';
import { buildNativeShareData } from './share-power';
import { recordShareEvent } from './record-share';
import { trackVisitorFunnel } from './visitor-tracking';
import { isSharePendingLocal } from './share-first-ui';
import { showToast } from '../ui';
import { dismissShareAbandon } from './share-abandon-rescue';

export const POST_LINK_ATTR = 'data-vr-post-link-one';

export const POST_LINK_SHARE_TEXT = LOCKED_SHARE_TEXT;

const IDS = {
  root: 'post-link-share',
  heading: 'post-link-heading',
  url: 'post-link-url',
  primary: 'post-link-primary',
  copy: 'post-link-copy',
  helper: 'post-link-helper',
  whisper: 'post-link-whisper',
} as const;

export type PostLinkState = 'hidden' | 'loading' | 'ready' | 'error';

export function buildPostLinkShareText(link: string): string {
  const trimmed = link.trim();
  return POST_LINK_SHARE_TEXT.replace(/\{link\}/g, trimmed);
}

export function buildWhatsAppShareHref(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(buildPostLinkShareText(link))}`;
}

export function canUseNativeShare(payload: { title: string; text: string }): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  const canShare = (navigator as Navigator & { canShare?: (data: ShareData) => boolean }).canShare;
  if (typeof canShare === 'function') {
    try {
      return canShare.call(navigator, payload);
    } catch {
      return false;
    }
  }
  return true;
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function readReadyLink(): string {
  const fromScreen = el(IDS.url)?.textContent?.trim() || '';
  if (fromScreen && /\/r\//i.test(fromScreen)) return fromScreen;
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return input?.value?.trim() || '';
}

function setState(state: PostLinkState): void {
  const root = el(IDS.root);
  if (!root) return;
  root.dataset.state = state;
  root.classList.toggle('hidden', state === 'hidden');
  root.hidden = state === 'hidden';
}

function setPrimaryLabel(label: string): void {
  const btn = el<HTMLButtonElement>(IDS.primary);
  if (!btn) return;
  btn.textContent = label;
  btn.setAttribute('aria-label', label);
}

function paintPrimaryForDetection(link: string): void {
  const btn = el<HTMLButtonElement>(IDS.primary);
  if (!btn) return;
  const text = buildPostLinkShareText(link);
  const payload = buildNativeShareData(text, link);
  const native = canUseNativeShare(payload);
  btn.dataset.mode = native ? 'native' : 'whatsapp';
  setPrimaryLabel(SEND_NOW_LABEL);
  btn.classList.remove('hidden');
  btn.hidden = false;
  btn.disabled = false;
}

function focusHeading(): void {
  const heading = el(IDS.heading);
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

export function showPostLinkLoading(): void {
  wireOnce();
  dismissShareAbandon();
  document.documentElement.setAttribute(POST_LINK_ATTR, '1');
  const root = el(IDS.root);
  if (!root) return;
  setState('loading');
  const heading = el(IDS.heading);
  if (heading) heading.textContent = 'Getting your link…';
  const url = el(IDS.url);
  if (url) {
    url.textContent = '';
    url.classList.add('post-link-url--skeleton');
  }
  const primary = el<HTMLButtonElement>(IDS.primary);
  if (primary) {
    primary.classList.add('hidden');
    primary.hidden = true;
    primary.disabled = true;
  }
  const copy = el<HTMLButtonElement>(IDS.copy);
  if (copy) {
    copy.classList.add('hidden');
    copy.hidden = true;
  }
}

export function showPostLinkError(): void {
  wireOnce();
  dismissShareAbandon();
  document.documentElement.setAttribute(POST_LINK_ATTR, '1');
  const root = el(IDS.root);
  if (!root) return;
  setState('error');
  const heading = el(IDS.heading);
  if (heading) heading.textContent = 'Couldn’t make your link.';
  const url = el(IDS.url);
  if (url) {
    url.textContent = '';
    url.classList.remove('post-link-url--skeleton');
  }
  const primary = el<HTMLButtonElement>(IDS.primary);
  if (primary) {
    primary.dataset.mode = 'retry';
    setPrimaryLabel('Try again');
    primary.classList.remove('hidden');
    primary.hidden = false;
    primary.disabled = false;
  }
  const copy = el<HTMLButtonElement>(IDS.copy);
  if (copy) {
    copy.classList.add('hidden');
    copy.hidden = true;
  }
  const helper = el(IDS.helper);
  if (helper) helper.textContent = 'A friend opens it and taps Get my link. That’s what counts.';
}

export function showPostLinkReady(link: string): void {
  const trimmed = link.trim();
  if (!trimmed || !/\/r\//i.test(trimmed)) {
    const root = el(IDS.root);
    if (root) setState('hidden');
    return;
  }

  dismissShareAbandon();
  document.documentElement.setAttribute(POST_LINK_ATTR, '1');
  document.documentElement.setAttribute('data-vr-has-link', '1');
  const root = el(IDS.root);
  if (!root) return;

  wireOnce();
  setState('ready');
  const heading = el(IDS.heading);
  if (heading) heading.textContent = "You're racing.";
  const url = el(IDS.url);
  if (url) {
    url.textContent = trimmed;
    url.classList.remove('post-link-url--skeleton');
    url.hidden = false;
    url.removeAttribute('hidden');
  }
  paintPrimaryForDetection(trimmed);
  const tool = document.getElementById('post-link-tool');
  if (tool) {
    tool.textContent = 'This is your public link. Paste it in any bio, story, or text.';
    tool.removeAttribute('hidden');
  }
  const copy = el<HTMLButtonElement>(IDS.copy);
  if (copy) {
    copy.textContent = 'Copy link';
    copy.setAttribute('aria-label', 'Copy link');
    copy.classList.remove('hidden');
    copy.hidden = false;
  }
  const helper = el(IDS.helper);
  if (helper) helper.textContent = 'A friend opens it and taps Get my link. That’s what counts.';
  const whisper = el(IDS.whisper);
  if (whisper) {
    const pending = isSharePendingLocal();
    whisper.textContent = pending ? 'A friend needs to tap Get my link to lock it.' : '';
    whisper.classList.toggle('hidden', !pending);
    whisper.hidden = !pending;
  }
  requestAnimationFrame(() => focusHeading());
}

export function activatePostLinkShare(link: string): void {
  showPostLinkReady(link);
  void import('./post-link-status').then((m) => m.renderPostLinkStatus()).catch(() => {});
  void import('./site-drops-ui').then((m) => m.initSiteDropForm()).catch(() => {});
}

/** Same user-gesture share sheet (mobile). No-op when Web Share is missing. */
export function maybeOfferSameGestureShare(link: string): boolean {
  const trimmed = link.trim();
  if (!trimmed || !/\/r\//i.test(trimmed)) return false;
  const text = buildPostLinkShareText(trimmed);
  const payload = buildNativeShareData(text, trimmed);
  if (!canUseNativeShare(payload)) return false;
  try {
    const sharePromise = navigator.share(payload);
    void sharePromise.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function openWhatsApp(link: string): boolean {
  const href = buildWhatsAppShareHref(link);
  const opened = window.open(href, '_blank', 'noopener,noreferrer');
  return !!opened;
}

function selectLinkText(): void {
  const url = el(IDS.url);
  if (!url) return;
  const range = document.createRange();
  range.selectNodeContents(url);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  url.focus();
}

function fireShareEvent(platform: string, link: string): void {
  const code = link.match(/\/r\/([^/?#]+)/i)?.[1] || '';
  if (code) {
    recordShareEvent({ platform, referrer_code: code, referral_link: link });
  }
  trackVisitorFunnel('ShareReferral', { platform, confirmed: '0' });
}

export function onPostLinkPrimaryTap(event?: Event): void {
  event?.preventDefault();
  dismissShareAbandon();
  const btn = el<HTMLButtonElement>(IDS.primary);
  const mode = btn?.dataset.mode;
  if (mode === 'retry') {
    const w = window as unknown as { getMyReferralLinkInstant?: () => void };
    w.getMyReferralLinkInstant?.();
    return;
  }

  const link = readReadyLink();
  if (!link) return;

  const text = buildPostLinkShareText(link);
  const payload = buildNativeShareData(text, link);

  if (canUseNativeShare(payload)) {
    const sharePromise = navigator.share(payload);
    fireShareEvent('native', link);
    void sharePromise.catch((err: unknown) => {
      const name = (err as Error)?.name || '';
      if (name === 'AbortError' || name === 'NotAllowedError') return;
      if (!openWhatsApp(link)) {
        void onPostLinkCopyTap();
      } else {
        fireShareEvent('whatsapp', link);
      }
    });
    return;
  }

  if (openWhatsApp(link)) {
    fireShareEvent('whatsapp', link);
    return;
  }
  void onPostLinkCopyTap();
}

export async function onPostLinkCopyTap(): Promise<void> {
  dismissShareAbandon();
  const link = readReadyLink();
  if (!link) return;
  const copy = el<HTMLButtonElement>(IDS.copy);
  try {
    await navigator.clipboard.writeText(link);
    trackVisitorFunnel('CopyReferralLink');
    showToast('Link copied. A friend still has to tap Get my link.', 'info');
    if (copy) {
      copy.textContent = 'Copy link';
      copy.setAttribute('aria-label', 'Copy link');
    }
  } catch {
    selectLinkText();
    const helper = el(IDS.helper);
    if (helper) helper.textContent = 'Copy didn’t work. Long-press the link.';
  }
}

function wireOnce(): void {
  const root = el(IDS.root);
  if (!root || root.dataset.wired === '1') return;
  root.dataset.wired = '1';
  el(IDS.primary)?.addEventListener('click', onPostLinkPrimaryTap);
  el(IDS.copy)?.addEventListener('click', () => {
    void onPostLinkCopyTap();
  });
}

export function initPostLinkShare(): void {
  wireOnce();
}

registerGlobal('onPostLinkPrimaryTap', onPostLinkPrimaryTap);
registerGlobal('onPostLinkCopyTap', onPostLinkCopyTap);
