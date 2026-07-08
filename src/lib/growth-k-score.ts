/**
 * Personal viral coefficient (K) — referrals per share, gamified for referrers.
 */

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
      label: 'K pending',
      tip: 'Share once to unlock your viral coefficient.',
    };
  }

  const k = refs / shares;
  const display = k >= 10 ? '10+' : k.toFixed(2);

  if (k >= 1) {
    return {
      k,
      display,
      label: 'Viral K',
      tip: 'K ≥ 1 — each share brings a referral on average. Elite loop.',
    };
  }
  if (k >= 0.5) {
    return {
      k,
      display,
      label: 'Viral K',
      tip: 'Strong coefficient — a few more shares could 2× your referrals.',
    };
  }
  if (k > 0) {
    return {
      k,
      display,
      label: 'Viral K',
      tip: 'Shares are working — stack more to push K above 1.',
    };
  }

  return {
    k: 0,
    display: '0.00',
    label: 'Viral K',
    tip: 'No referrals yet from shares — try WhatsApp or copy message.',
  };
}