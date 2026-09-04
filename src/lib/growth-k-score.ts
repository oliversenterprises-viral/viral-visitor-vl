/**
 * Personal viral coefficient (K) — referrals per share, gamified for referrers.
 */

import { t } from './i18n';

export interface PersonalKScore {
  /** Estimated K = referrals / shares (0 if no shares yet). */
  k: number;
  display: string;
  label: string;
  tip: string;
}

export function computePersonalKScore(referrals: number, totalShares: number): PersonalKScore {
  const refs = Math.max(0, referrals);
  const shares = Math.max(0, totalShares);

  if (shares === 0) {
    return {
      k: 0,
      display: '—',
      label: t('k.pending'),
      tip: t('k.tip_pending'),
    };
  }

  const k = refs / shares;
  const display = k >= 10 ? '10+' : k.toFixed(2);

  if (k >= 1) {
    return {
      k,
      display,
      label: t('k.label'),
      tip: t('k.tip_elite'),
    };
  }
  if (k >= 0.5) {
    return {
      k,
      display,
      label: t('k.label'),
      tip: t('k.tip_strong'),
    };
  }
  if (k > 0) {
    return {
      k,
      display,
      label: t('k.label'),
      tip: t('k.tip_working'),
    };
  }

  return {
    k: 0,
    display: '0.00',
    label: t('k.label'),
    tip: t('k.tip_zero'),
  };
}