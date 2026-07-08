/**
 * Lightweight share celebration — once per session to avoid noise.
 */

const SESSION_KEY = 'vr_share_confetti_done';

export function celebrateShareIfFirst(): void {
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    return;
  }

  import('canvas-confetti')
    .then(({ default: confetti }) => {
      confetti({
        particleCount: 42,
        spread: 62,
        origin: { y: 0.72 },
        colors: ['#34d399', '#a78bfa', '#f472b6'],
      });
    })
    .catch(() => {});
}