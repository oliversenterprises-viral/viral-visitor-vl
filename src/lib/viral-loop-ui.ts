/**
 * Viral Loop UI — power meter, daily quest bar, combo badge sync.
 */

import { getShareStreakCount } from './share-streak';
import {
  getShareLeaderboardRank,
  getShareReferralCount,
  getShareGapToNextRank,
} from './share-context';
import { computeViralPower, viralPowerTierColor, type ViralPowerTier } from './viral-power';
import {
  consumeDailyQuestCelebration,
  dailyQuestLabel,
  dailyQuestProgress,
  getDailyShareCount,
  isDailyQuestComplete,
  recordDailyShare,
} from './daily-share-quest';
import { getShareComboCount, recordShareCombo, shareComboLabel } from './share-combo';
import { showToast } from '../ui';
import { tryHapticPulse } from './haptic';
import { syncGrowthCommandCenter } from './growth-command-center';

function hasReferralLink(): boolean {
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

function tierDataAttr(tier: ViralPowerTier): void {
  document.documentElement.setAttribute('data-vr-viral-tier', tier);
}

function renderPowerMeter(): void {
  const el = document.getElementById('viral-power-meter');
  if (!el) return;

  if (!hasReferralLink()) {
    el.classList.add('hidden');
    document.documentElement.removeAttribute('data-vr-viral-tier');
    return;
  }

  const power = computeViralPower({
    shareStreak: getShareStreakCount(),
    referrals: getShareReferralCount(),
    rank: getShareLeaderboardRank(),
    gapToNext: getShareGapToNextRank(),
    dailySharesToday: getDailyShareCount(),
  });

  tierDataAttr(power.tier);
  el.classList.remove('hidden');
  el.classList.toggle('viral-power-meter--rush', power.isOvertakeRush);

  const scoreEl = el.querySelector('[data-viral-power-score]');
  const labelEl = el.querySelector('[data-viral-power-label]');
  const tipEl = el.querySelector('[data-viral-power-tip]');
  const fillEl = el.querySelector('[data-viral-power-fill]') as HTMLElement | null;

  if (scoreEl) scoreEl.textContent = String(power.score);
  if (labelEl) labelEl.textContent = power.label;
  if (tipEl) tipEl.textContent = power.tip;
  if (fillEl) {
    fillEl.style.width = `${power.score}%`;
    fillEl.className = `viral-power-meter__fill bg-gradient-to-r ${viralPowerTierColor(power.tier)}`;
  }
}

function renderDailyQuest(): void {
  const el = document.getElementById('daily-share-quest');
  if (!el) return;

  if (!hasReferralLink()) {
    el.classList.add('hidden');
    return;
  }

  const { percent } = dailyQuestProgress();
  el.classList.remove('hidden');
  el.classList.toggle('daily-share-quest--complete', isDailyQuestComplete());

  const label = el.querySelector('[data-daily-quest-label]');
  const fill = el.querySelector('[data-daily-quest-fill]') as HTMLElement | null;
  if (label) label.textContent = dailyQuestLabel();
  if (fill) fill.style.width = `${percent}%`;
}

function renderComboBadge(): void {
  const el = document.getElementById('share-combo-badge');
  if (!el) return;

  const combo = getShareComboCount();
  const label = shareComboLabel(combo);
  if (!hasReferralLink() || !label) {
    el.classList.add('hidden');
    return;
  }

  el.textContent = label;
  el.classList.remove('hidden');
}

/** Refresh all viral loop widgets. */
export function syncViralLoopUI(): void {
  renderPowerMeter();
  renderDailyQuest();
  renderComboBadge();
  syncGrowthCommandCenter();
}

/** Call after each share — updates quest, combo, power + celebrations. */
export function onViralLoopShare(): void {
  recordDailyShare();
  const { combo } = recordShareCombo();
  syncViralLoopUI();

  if (combo >= 2) {
    tryHapticPulse(combo >= 3 ? [10, 30, 10] : 10);
  }

  if (consumeDailyQuestCelebration()) {
    showToast('Daily quest complete — max viral boost unlocked!', 'success');
    tryHapticPulse([15, 40, 15]);
    void import('canvas-confetti').then(({ default: confetti }) => {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#34d399', '#a78bfa', '#fbbf24'],
      });
    }).catch(() => {});
  }
}

export function initViralLoopUI(): void {
  syncViralLoopUI();
}