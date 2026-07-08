/**
 * Growth Command Center — unified viral growth hub (power, K, quest, next action).
 */

import { getShareStreakCount } from './share-streak';
import {
  getShareLeaderboardRank,
  getShareReferralCount,
  getShareGapToNextRank,
  isMobileShareContext,
} from './share-context';
import { computeViralPower, viralPowerTierColor } from './viral-power';
import {
  dailyQuestProgress,
  getDailyShareCount,
  isDailyQuestComplete,
} from './daily-share-quest';
import { getShareComboCount, shareComboLabel } from './share-combo';
import { isGrowthEngineEnabled } from './optimizer-flags';
import { isNativeShareSupported } from './share-power';
import {
  resolveGrowthNextAction,
  type GrowthNextActionKind,
} from './growth-next-action';
import { resolveDuelRivalCode, shouldShowDuelInviteStrip } from './duel-invite';
import { computePersonalKScore } from './growth-k-score';

function hasReferralLink(): boolean {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

function readFunnelStep(): number | null {
  const raw = document.documentElement.getAttribute('data-vr-funnel-guide-step');
  if (!raw) return null;
  const n = Number(raw);
  return n >= 1 && n <= 3 ? n : null;
}

function runGrowthAction(kind: GrowthNextActionKind): void {
  const w = window as unknown as Record<string, (() => void) | undefined>;
  switch (kind) {
    case 'get_link':
      w.getMyReferralLinkInstant?.();
      break;
    case 'copy_link':
      document.getElementById('copy-link-btn')?.click();
      break;
    case 'whatsapp_boost':
      w.boostShareWhatsApp?.();
      break;
    case 'duel_invite':
      (w.boostDuelShareWhatsApp as (() => void) | undefined)?.() ?? w.boostShareWhatsApp?.();
      break;
    case 'native_share':
      w.nativeShare?.();
      break;
    case 'copy_message':
      w.copyShareMessage?.();
      break;
    case 'open_share_panel':
      document.getElementById('share-buttons-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
  }
}

let ctaWired = false;

function wireGrowthCta(): void {
  if (ctaWired) return;
  const btn = document.getElementById('growth-command-cta');
  if (!btn) return;
  ctaWired = true;
  btn.dataset.vrWired = '1';
  btn.addEventListener('click', () => {
    const kind = btn.getAttribute('data-growth-action-kind') as GrowthNextActionKind | null;
    if (kind) runGrowthAction(kind);
  });
}

/** Render unified growth command center (hides legacy widgets via html attr). */
export function syncGrowthCommandCenter(): void {
  const root = document.getElementById('growth-command-center');
  if (!root) return;

  wireGrowthCta();

  const hasLink = hasReferralLink();
  document.documentElement.toggleAttribute('data-vr-growth-hub', hasLink);

  if (!hasLink) {
    root.classList.add('hidden');
    return;
  }

  root.classList.remove('hidden');

  const power = computeViralPower({
    shareStreak: getShareStreakCount(),
    referrals: getShareReferralCount(),
    rank: getShareLeaderboardRank(),
    gapToNext: getShareGapToNextRank(),
    dailySharesToday: getDailyShareCount(),
  });

  const kScore = computePersonalKScore(getShareReferralCount(), getShareStreakCount());
  const quest = dailyQuestProgress();
  const combo = getShareComboCount();
  const comboLabel = shareComboLabel(combo);

  const action = resolveGrowthNextAction({
    hasLink: true,
    funnelStep: readFunnelStep(),
    referrals: getShareReferralCount(),
    rank: getShareLeaderboardRank(),
    gapToNext: getShareGapToNextRank(),
    dailyShares: getDailyShareCount(),
    shareStreak: getShareStreakCount(),
    isMobile: isMobileShareContext(),
    nativeShareAvailable: isNativeShareSupported(),
    duelInviteEligible: shouldShowDuelInviteStrip(),
    landingRef: resolveDuelRivalCode(),
  });

  const scoreEl = root.querySelector('[data-growth-power-score]');
  const tierEl = root.querySelector('[data-growth-power-tier]');
  const fillEl = root.querySelector('[data-growth-power-fill]') as HTMLElement | null;
  const kEl = root.querySelector('[data-growth-k-display]');
  const kTipEl = root.querySelector('[data-growth-k-tip]');
  const questEl = root.querySelector('[data-growth-quest-label]');
  const questFill = root.querySelector('[data-growth-quest-fill]') as HTMLElement | null;
  const headlineEl = root.querySelector('[data-growth-action-headline]');
  const sublineEl = root.querySelector('[data-growth-action-subline]');
  const cta = document.getElementById('growth-command-cta');
  const boostBadge = root.querySelector('[data-growth-boost-badge]');
  const comboEl = root.querySelector('[data-growth-combo]');

  if (scoreEl) scoreEl.textContent = String(power.score);
  if (tierEl) tierEl.textContent = power.label;
  if (fillEl) {
    fillEl.style.width = `${power.score}%`;
    fillEl.className = `growth-command-center__power-fill bg-gradient-to-r ${viralPowerTierColor(power.tier)}`;
  }
  if (kEl) kEl.textContent = kScore.display;
  if (kTipEl) kTipEl.textContent = kScore.tip;
  if (questEl) {
    questEl.textContent = isDailyQuestComplete()
      ? `Daily quest ✓ ${quest.goal}/${quest.goal}`
      : `Quest ${quest.current}/${quest.goal} shares`;
  }
  if (questFill) questFill.style.width = `${quest.percent}%`;
  if (headlineEl) headlineEl.textContent = action.headline;
  if (sublineEl) sublineEl.textContent = action.subline;
  if (cta) {
    cta.textContent = action.ctaLabel;
    cta.setAttribute('data-growth-action-kind', action.kind);
    cta.classList.toggle('growth-command-cta--critical', action.urgency === 'critical');
    cta.classList.toggle('growth-command-cta--high', action.urgency === 'high');
  }

  root.classList.toggle('growth-command-center--rush', power.isOvertakeRush);

  if (boostBadge) {
    boostBadge.classList.toggle('hidden', !isGrowthEngineEnabled());
  }

  if (comboEl) {
    if (comboLabel) {
      comboEl.textContent = comboLabel;
      comboEl.classList.remove('hidden');
    } else {
      comboEl.classList.add('hidden');
    }
  }

  document.documentElement.setAttribute('data-vr-viral-tier', power.tier);
}

export function initGrowthCommandCenter(): void {
  syncGrowthCommandCenter();
}