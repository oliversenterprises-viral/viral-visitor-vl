/**
 * Post-share return loop — after a *confirmed* lock, make rank receipt +
 * challenge the default next actions (not more chrome).
 */

import { getMyReferralCode, getReferralBaseUrl } from '../public/globals';
import { buildReferralLinkFromBase } from './referral-url';
import {
  getShareLeaderboardRank,
  getShareReferralCount,
} from './share-context';
import { offerRankReceipt } from './rank-receipt-card';
import { syncDuelInviteStrip, triggerDuelInviteMoment } from './duel-invite';
import { showToast } from '../ui';
import { trackViralLoopEvent } from './visitor-tracking';
import { t, type MessageKey } from './i18n';

function buildMyLink(): string {
  const code = getMyReferralCode();
  if (!code) return '';
  try {
    const base = getReferralBaseUrl() || (typeof location !== 'undefined' ? location.origin : 'https://www.viralrefer.app');
    return buildReferralLinkFromBase(code, base, 'https://www.viralrefer.app');
  } catch {
    return `https://www.viralrefer.app/r/${code}`;
  }
}

function scrollToPostShareHub(): void {
  const run = () => {
    const el =
      document.getElementById('post-share-return-hub') ||
      document.getElementById('duel-invite-strip') ||
      document.getElementById('rank-receipt-cta') ||
      document.getElementById('share-first-strip');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.setTimeout(run, 100));
  });
}

function renderPostShareHub(rank: number | null, referrals: number): void {
  let hub = document.getElementById('post-share-return-hub');
  if (!hub) {
    hub = document.createElement('div');
    hub.id = 'post-share-return-hub';
    hub.className = 'post-share-return-hub mb-4 rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-500/15 via-zinc-900/90 to-violet-500/15 px-4 py-4';
    hub.setAttribute('role', 'region');
    hub.setAttribute('aria-label', 'After share — climb next');
    const anchor =
      document.getElementById('share-first-strip') ||
      document.getElementById('share-power-block') ||
      document.getElementById('referral-section');
    if (anchor?.parentElement) {
      anchor.insertAdjacentElement('afterend', hub);
    } else {
      document.body.appendChild(hub);
    }
  }

  const rankLabel = rank && rank > 0 ? `#${rank}` : 'Unranked';
  const refLabel = referrals === 1 ? '1 referral' : `${referrals} referrals`;

  hub.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/25 text-emerald-200 flex items-center justify-center" aria-hidden="true">
        <i class="fa-solid fa-lock-open"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-[10px] uppercase tracking-wider font-bold text-emerald-300/95">Link locked · you're in</p>
        <p class="text-base font-bold text-white mt-0.5 leading-snug" data-post-share-title>
          ${t('post_share.title' as MessageKey)}
        </p>
        <p class="text-[12px] text-zinc-400 mt-1 leading-snug" data-post-share-sub>
          ${t('post_share.sub' as MessageKey)}
        </p>
        <div class="flex flex-wrap gap-3 mt-2 text-xs">
          <span class="text-zinc-500">Rank <strong class="text-violet-200 tabular-nums" data-post-share-rank>${rankLabel}</strong></span>
          <span class="text-zinc-500">Board <strong class="text-emerald-300 tabular-nums" data-post-share-refs>${refLabel}</strong></span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <button type="button" data-post-share-challenge
            class="w-full py-3 px-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 shadow-lg shadow-rose-900/20">
            <i class="fa-solid fa-fire mr-1.5" aria-hidden="true"></i>${t('post_share.cta_challenge' as MessageKey)}
          </button>
          <button type="button" data-post-share-receipt
            class="w-full py-3 px-4 rounded-2xl font-semibold text-sm text-violet-100 bg-violet-600/80 hover:bg-violet-500 border border-violet-400/30">
            <i class="fa-solid fa-id-card mr-1.5" aria-hidden="true"></i>${t('post_share.cta_receipt' as MessageKey)}
          </button>
        </div>
        <p class="text-[11px] text-amber-200/90 mt-2.5 leading-snug" data-post-share-prize>
          ${t('post_share.prize_nudge' as MessageKey)}
        </p>
      </div>
    </div>`;

  hub.classList.remove('hidden');

  hub.querySelector('[data-post-share-challenge]')?.addEventListener('click', () => {
    const duelBtn = document.querySelector(
      '#duel-invite-strip button',
    ) as HTMLElement | null;
    if (duelBtn) {
      duelBtn.click();
      return;
    }
    const w = window as unknown as { boostDuelShareWhatsApp?: () => void };
    if (typeof w.boostDuelShareWhatsApp === 'function') {
      w.boostDuelShareWhatsApp();
      return;
    }
    document.getElementById('share-first-whatsapp')?.click();
  });

  hub.querySelector('[data-post-share-receipt]')?.addEventListener('click', () => {
    document.getElementById('rank-receipt-cta')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    document.getElementById('rank-receipt-download')?.classList.add('share-first-pulse');
    window.setTimeout(() => {
      document.getElementById('rank-receipt-download')?.classList.remove('share-first-pulse');
    }, 2400);
  });
}

/**
 * Call after confirmed lock (native success or "Yes, I sent it").
 * Default path: challenge + rank receipt, prize FOMO, scroll into hub.
 */
export async function activatePostShareReturnLoop(): Promise<void> {
  const code = getMyReferralCode();
  if (!code) return;

  document.documentElement.setAttribute('data-vr-post-share-return', '1');
  document.documentElement.setAttribute('data-vr-share-locked', '1');
  document.documentElement.removeAttribute('data-vr-share-pending');
  document.documentElement.removeAttribute('data-vr-confirm-dismissed');
  document.getElementById('share-still-pending-chip')?.classList.add('hidden');

  const rank = getShareLeaderboardRank();
  const referrals = getShareReferralCount();
  const link = buildMyLink() || `https://www.viralrefer.app/r/${code}`;

  renderPostShareHub(rank, referrals);

  // Rank receipt even when unranked (first-share proof)
  try {
    await offerRankReceipt({
      code,
      link,
      rank: rank && rank > 0 ? rank : null,
      referrals: referrals || 0,
    });
    document.documentElement.setAttribute('data-vr-receipt-offered', '1');
  } catch {
    /* non-fatal */
  }

  // Challenge as primary next share
  try {
    syncDuelInviteStrip();
    triggerDuelInviteMoment();
  } catch {
    /* non-fatal */
  }

  // Growth hub CTA → challenge if present
  const growthCta = document.getElementById('growth-command-cta');
  if (growthCta) {
    growthCta.textContent = t('post_share.cta_challenge' as MessageKey);
  }

  scrollToPostShareHub();

  showToast(t('post_share.toast' as MessageKey), 'success');
  trackViralLoopEvent('PostShareReturn', {
    rank: rank != null ? String(rank) : '0',
    referrals: String(referrals || 0),
  });
}
