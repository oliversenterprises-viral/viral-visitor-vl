/**
 * First-share celebration + durable "Competitor" badge (client-only).
 * Confetti once per session; badge persists in localStorage.
 */

const SESSION_KEY = 'vr_share_confetti_done';
const BADGE_KEY = 'vr_competitor_badge_v1';

export function hasCompetitorBadge(): boolean {
  try {
    return localStorage.getItem(BADGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Unlock permanent Competitor badge. Returns true if newly unlocked. */
export function unlockCompetitorBadge(): boolean {
  if (hasCompetitorBadge()) return false;
  try {
    localStorage.setItem(BADGE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/** For tests — clear badge state. */
export function clearCompetitorBadgeForTests(): void {
  try {
    localStorage.removeItem(BADGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function syncCompetitorBadgeUI(): void {
  const el = document.getElementById('competitor-badge');
  if (!el) return;
  if (hasCompetitorBadge()) {
    el.classList.remove('hidden');
    document.documentElement.setAttribute('data-vr-competitor', '1');
  } else {
    el.classList.add('hidden');
    document.documentElement.removeAttribute('data-vr-competitor');
  }
}

/**
 * Celebrate first platform share of the session + unlock Competitor badge once.
 * Safe to call on every share — no-ops after unlock / session confetti.
 */
export function celebrateShareIfFirst(): void {
  const newlyUnlocked = unlockCompetitorBadge();
  syncCompetitorBadgeUI();

  if (newlyUnlocked) {
    try {
      // Lazy toast — avoid circular import cost on cold path when no DOM toast needed for re-entry
      void import('../ui').then(({ showToast }) => {
        showToast("You're in the race — Competitor badge unlocked!", 'success');
      });
    } catch {
      /* non-critical */
    }
  }

  let shouldConfetti = false;
  try {
    if (sessionStorage.getItem(SESSION_KEY) !== '1') {
      sessionStorage.setItem(SESSION_KEY, '1');
      shouldConfetti = true;
    }
  } catch {
    // sessionStorage blocked — still allow confetti once if badge was new
    shouldConfetti = newlyUnlocked;
  }

  if (!shouldConfetti) return;

  import('canvas-confetti')
    .then(({ default: confetti }) => {
      confetti({
        particleCount: 48,
        spread: 68,
        origin: { y: 0.72 },
        colors: ['#34d399', '#a78bfa', '#f472b6', '#fbbf24'],
      });
    })
    .catch(() => {});
}
