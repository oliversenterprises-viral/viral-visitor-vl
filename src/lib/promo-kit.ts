/**
 * Promo Kit — marketing assets for locked referrers only.
 * Gate: html[data-vr-share-locked] (first friend completed Get my link).
 * Does not change referral recording or lock rules.
 */

import { getMyReferralCode, getReferralBaseUrl } from '../public/globals';
import { registerGlobal } from './global';
import { showToast } from '../ui';
import { trackViralLoopEvent } from './visitor-tracking';

const BANNER_BASE = 'https://www.viralrefer.app/assets/banners';
const TELEGRAM_BOT = 'https://t.me/myviralreferbot';

export type PromoBannerSpec = {
  id: string;
  label: string;
  file: string;
  size: string;
};

/** Hosted static creatives (personalized via caption + /r/CODE, not image embeds). */
export const PROMO_BANNERS: PromoBannerSpec[] = [
  { id: '1200x628', label: 'Social (FB / Reddit)', file: 'viralrefer-social-1200x628.png', size: '1200×628' },
  { id: '1080x1080', label: 'Square', file: 'viralrefer-social-1080x1080.png', size: '1080×1080' },
  { id: '1280x720', label: 'HD / Telegram', file: 'viralrefer-social-1280x720.png', size: '1280×720' },
  { id: '1080x1920', label: 'Story', file: 'viralrefer-social-1080x1920.png', size: '1080×1920' },
  { id: '728x90', label: 'Leaderboard ad', file: 'viralrefer-728x90.png', size: '728×90' },
  { id: '300x250', label: 'Medium rectangle', file: 'viralrefer-300x250.png', size: '300×250' },
];

export function isPromoKitUnlocked(root: HTMLElement = document.documentElement): boolean {
  return root.hasAttribute('data-vr-share-locked');
}

export function hasPromoKitLinkReady(root: HTMLElement = document.documentElement): boolean {
  return root.hasAttribute('data-vr-has-link');
}

export function buildPersonalPromoLink(code: string, content = 'promo_kit'): string | null {
  const c = String(code || '').trim().toUpperCase();
  if (!/^VIRAL-[A-Z0-9]+$/.test(c)) return null;
  const base = (getReferralBaseUrl() || 'https://www.viralrefer.app').replace(/\/$/, '');
  const u = new URL(`${base}/r/${c}`);
  u.searchParams.set('utm_source', 'promo_kit');
  u.searchParams.set('utm_medium', 'share');
  u.searchParams.set('utm_campaign', 'locked_referrer');
  u.searchParams.set('utm_content', content);
  return u.toString();
}

export function buildPromoCaptions(personalLink: string): {
  short: string;
  long: string;
  xSafe: string;
} {
  return {
    short: `Get a free ViralRefer link in ~30 seconds. No signup. Climb the live board — #1 can claim a homepage feature.\n\n${personalLink}`,
    long: `I locked my spot on ViralRefer (free worldwide referral leaderboard).\n\n• Free link in ~30 seconds\n• No email / no signup\n• #1 claims a homepage feature (no cash prize)\n• Open worldwide · 18+\n\nJoin with my link:\n${personalLink}`,
    xSafe:
      'Live free referral leaderboard on ViralRefer 🏆 No signup · #1 can claim a homepage feature. Link is in my promo image / comments.',
  };
}

export function bannerUrl(file: string): string {
  return `${BANNER_BASE}/${file}`;
}

function resolveCode(): string | null {
  const code = getMyReferralCode() || localStorage.getItem('vr_my_ref_code');
  const c = String(code || '').trim().toUpperCase();
  return /^VIRAL-[A-Z0-9]+$/.test(c) ? c : null;
}

async function copyText(text: string, okMsg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMsg, 'success');
  } catch {
    showToast('Could not copy — select and copy manually', 'info');
  }
}

export function syncPromoKitUI(): void {
  const kit = document.getElementById('promo-kit');
  const teaser = document.getElementById('promo-kit-teaser');
  if (!kit && !teaser) return;

  const unlocked = isPromoKitUnlocked();
  const hasLink = hasPromoKitLinkReady();

  if (kit) {
    kit.classList.toggle('hidden', !unlocked);
    kit.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
  }
  if (teaser) {
    // Tease only after they have a link but before lock
    const showTeaser = hasLink && !unlocked;
    teaser.classList.toggle('hidden', !showTeaser);
    teaser.setAttribute('aria-hidden', showTeaser ? 'false' : 'true');
  }

  if (!unlocked) return;

  const code = resolveCode();
  const link = code ? buildPersonalPromoLink(code, 'kit_panel') : null;
  const linkEl = document.getElementById('promo-kit-personal-link');
  const codeEl = document.getElementById('promo-kit-code');
  if (codeEl) codeEl.textContent = code || '—';
  if (linkEl) {
    if (link) {
      linkEl.textContent = link;
      (linkEl as HTMLAnchorElement).href = link;
    } else {
      linkEl.textContent = 'Get your link first, then lock it with a friend.';
    }
  }
}

export function copyPromoCaption(kind: 'short' | 'long' | 'xSafe' = 'short'): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  const code = resolveCode();
  const link = code ? buildPersonalPromoLink(code, `caption_${kind}`) : null;
  if (!link) {
    showToast('Your referral code is missing — refresh and try again', 'info');
    return;
  }
  const caps = buildPromoCaptions(link);
  void copyText(caps[kind], 'Caption copied — paste with your banner');
  trackViralLoopEvent('PromoKitCopyCaption', { kind });
}

export function copyPromoPersonalLink(): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  const code = resolveCode();
  const link = code ? buildPersonalPromoLink(code, 'copy_link') : null;
  if (!link) {
    showToast('Your referral code is missing — refresh and try again', 'info');
    return;
  }
  void copyText(link, 'Your promo link copied');
  trackViralLoopEvent('PromoKitCopyLink', {});
}

export function openPromoBanner(id: string): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  const spec = PROMO_BANNERS.find((b) => b.id === id);
  if (!spec) return;
  const url = bannerUrl(spec.file);
  window.open(url, '_blank', 'noopener,noreferrer');
  trackViralLoopEvent('PromoKitOpenBanner', { id });
  showToast(`${spec.label} opened — download image, post with your link below`, 'info');
}

export function openPromoTelegramHelper(): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  window.open(`${TELEGRAM_BOT}?start=promo_kit`, '_blank', 'noopener,noreferrer');
  trackViralLoopEvent('PromoKitTelegram', {});
}

export function runPromoSharePack(): void {
  if (!isPromoKitUnlocked()) {
    showToast('Promo Kit unlocks when your first friend gets their free link', 'info');
    return;
  }
  const fn = (window as unknown as { downloadSharePack?: () => void }).downloadSharePack;
  if (typeof fn === 'function') {
    fn();
    trackViralLoopEvent('PromoKitSharePack', {});
  } else {
    showToast('Share pack not ready — use Story / square buttons above', 'info');
  }
}

let wired = false;

export function initPromoKit(): void {
  if (wired) {
    syncPromoKitUI();
    return;
  }
  wired = true;

  registerGlobal('copyPromoCaption', (kind?: string) => {
    const k = kind === 'long' || kind === 'xSafe' ? kind : 'short';
    copyPromoCaption(k);
  });
  registerGlobal('copyPromoPersonalLink', copyPromoPersonalLink);
  registerGlobal('openPromoBanner', openPromoBanner);
  registerGlobal('openPromoTelegramHelper', openPromoTelegramHelper);
  registerGlobal('runPromoSharePack', runPromoSharePack);
  registerGlobal('syncPromoKitUI', syncPromoKitUI);

  // Fill banner buttons once
  const list = document.getElementById('promo-kit-banners');
  if (list && !list.dataset.filled) {
    list.dataset.filled = '1';
    list.innerHTML = PROMO_BANNERS.map(
      (b) => `
      <button type="button" class="promo-kit-banner-btn" data-promo-banner="${b.id}"
              title="Open ${b.size} banner">
        <span class="promo-kit-banner-size">${b.size}</span>
        <span class="promo-kit-banner-label">${b.label}</span>
      </button>`,
    ).join('');
    list.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-promo-banner]') as HTMLElement | null;
      if (!t) return;
      openPromoBanner(t.getAttribute('data-promo-banner') || '');
    });
  }

  // Observe lock flag flips without polling
  try {
    const mo = new MutationObserver(() => syncPromoKitUI());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-vr-share-locked', 'data-vr-has-link'],
    });
  } catch {
    /* ignore */
  }

  syncPromoKitUI();
}
