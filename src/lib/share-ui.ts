/**
 * Share panel DOM sync — preview tabs, A/B variants, native-share visibility, streak badge.
 */

import {
  buildShareMessage,
  isNativeShareSupported,
  extractReferralCodeFromLink,
  type SharePlatform,
} from './share-power';
import { getShareStreakCount, shareStreakLabel } from './share-streak';
import {
  getShareLeaderboardRank,
  getShareReferralCount,
  isMobileShareContext,
} from './share-context';
import { buildShareRankCta } from './share-rank-cta';
import {
  resolveShareAbVariant,
  setStoredShareAbVariant,
  shareAbVariantLabel,
  type ShareAbVariant,
} from './share-ab';
import { resolveShareMessageBuildOptions } from './share-message-options';
import { syncViralLoopUI } from './viral-loop-ui';

let activePreviewPlatform: SharePlatform = 'whatsapp';

export function getActivePreviewPlatform(): SharePlatform {
  return activePreviewPlatform;
}

function refreshSharePreview(link: string, platform = activePreviewPlatform): void {
  const preview = document.getElementById('share-message-preview');
  if (!preview || !link) return;
  preview.textContent = buildShareMessage(link, resolveShareMessageBuildOptions(platform, link));
}

function updateAbVariantUI(link: string): void {
  const code = extractReferralCodeFromLink(link);
  if (!code) return;
  const variant = resolveShareAbVariant(code);
  document.querySelectorAll('[data-share-ab-tab]').forEach((el) => {
    const v = (el as HTMLElement).dataset.shareAbTab as ShareAbVariant;
    const active = v === variant;
    el.classList.toggle('share-ab-tab-active', active);
    el.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const label = document.getElementById('share-ab-label');
  if (label) label.textContent = shareAbVariantLabel(variant);
}

/** Switch live preview to a platform-specific message. */
export function setSharePreviewPlatform(platform: SharePlatform): void {
  activePreviewPlatform = platform;

  document.querySelectorAll('[data-share-preview-tab]').forEach((el) => {
    const tabPlatform = (el as HTMLElement).dataset.sharePreviewTab;
    const active = tabPlatform === platform;
    el.classList.toggle('share-preview-tab-active', active);
    el.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const link =
    (document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim() || '';
  refreshSharePreview(link, platform);
}

/** User-selected A/B variant (persisted). */
export function setShareAbVariant(variant: ShareAbVariant): void {
  setStoredShareAbVariant(variant);
  const link =
    (document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim() || '';
  if (link) {
    updateAbVariantUI(link);
    refreshSharePreview(link);
  }
}

function wirePreviewTabs(): void {
  if (document.documentElement.dataset.vrShareTabsBound === '1') return;
  document.documentElement.dataset.vrShareTabsBound = '1';

  document.querySelectorAll('[data-share-preview-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      const platform = (el as HTMLElement).dataset.sharePreviewTab as SharePlatform;
      if (platform) setSharePreviewPlatform(platform);
    });
  });

  document.querySelectorAll('[data-share-ab-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      const variant = (el as HTMLElement).dataset.shareAbTab as ShareAbVariant;
      if (variant === 'a' || variant === 'b') setShareAbVariant(variant);
    });
  });
}

function updateShortCodeChip(link: string): void {
  const chip = document.getElementById('share-short-code');
  const code = extractReferralCodeFromLink(link);
  if (!chip) return;
  if (code) {
    chip.textContent = code;
    chip.classList.remove('hidden');
  } else {
    chip.classList.add('hidden');
  }
}

function updateShareRankCta(): void {
  const banner = document.getElementById('share-rank-cta');
  if (!banner) return;

  const link =
    (document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim() || '';
  if (!link) {
    banner.classList.add('hidden');
    return;
  }

  const cta = buildShareRankCta(getShareLeaderboardRank(), getShareReferralCount());
  banner.className = `share-rank-cta share-rank-cta--${cta.tone} mb-3 rounded-2xl border px-4 py-3`;
  banner.classList.remove('hidden');

  const headline = banner.querySelector('[data-share-rank-headline]');
  const subline = banner.querySelector('[data-share-rank-subline]');
  if (headline) headline.textContent = cta.headline;
  if (subline) subline.textContent = cta.subline;

  const boostBtn = document.getElementById('boost-whatsapp-btn');
  if (boostBtn) {
    boostBtn.classList.toggle('share-rank-boost-pulse', Boolean(cta.emphasizeBoost && isMobileShareContext()));
  }
}

function updateShareStreakBadge(): void {
  const badge = document.getElementById('share-streak-badge');
  if (!badge) return;
  const count = getShareStreakCount();
  const label = shareStreakLabel(count);
  if (label) {
    badge.textContent = label;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/** Refresh native-share visibility and live message preview when link is ready. */
export function syncSharePowerUI(link?: string): void {
  wirePreviewTabs();

  const resolvedLink =
    link ||
    (document.getElementById('ref-link') as HTMLInputElement | null)?.value?.trim() ||
    '';

  const nativeBtn = document.getElementById('native-share-btn');
  if (nativeBtn) {
    if (resolvedLink && isNativeShareSupported()) {
      nativeBtn.classList.remove('hidden');
    } else {
      nativeBtn.classList.add('hidden');
    }
  }

  if (resolvedLink) {
    updateAbVariantUI(resolvedLink);
    setSharePreviewPlatform(activePreviewPlatform);
    updateShortCodeChip(resolvedLink);
  }

  updateShareStreakBadge();

  const copyMsgBtn = document.getElementById('copy-message-btn');
  if (copyMsgBtn) {
    if (resolvedLink) copyMsgBtn.classList.remove('hidden');
    else copyMsgBtn.classList.add('hidden');
  }

  const toolsRow = document.getElementById('share-tools-row');
  if (toolsRow) {
    if (resolvedLink) toolsRow.classList.remove('hidden');
    else toolsRow.classList.add('hidden');
  }

  const abWrap = document.getElementById('share-ab-wrap');
  if (abWrap) {
    if (resolvedLink) abWrap.classList.remove('hidden');
    else abWrap.classList.add('hidden');
  }

  const packBtn = document.querySelector<HTMLButtonElement>('[onclick="downloadSharePack()"]');
  if (packBtn) {
    const isWinner = getShareLeaderboardRank() === 1;
    packBtn.classList.toggle('share-winner-pack-btn', isWinner);
    packBtn.innerHTML = `<i class="fa-solid fa-box-archive"></i> <span class="share-pack-label">${isWinner ? 'Winner pack' : 'Share pack'}</span>`;
    packBtn.setAttribute(
      'title',
      isWinner ? 'Download gold #1 winner share images' : 'Download square + story share images',
    );
  }

  const boostBtn = document.getElementById('boost-whatsapp-btn');
  if (boostBtn) {
    if (resolvedLink && isMobileShareContext()) boostBtn.classList.remove('hidden');
    else boostBtn.classList.add('hidden');
  }

  updateShareRankCta();
  syncViralLoopUI();

  document.documentElement.toggleAttribute('data-vr-share-mobile', isMobileShareContext());
}

/** Call after any share action to refresh streak display. */
export function refreshShareStreakUI(): void {
  updateShareStreakBadge();
}