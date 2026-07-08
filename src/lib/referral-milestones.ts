/**
 * Referral & rank milestone detection — confetti + toasts when users level up.
 */

import { showToast } from '../ui';

const COUNT_KEY = 'vr_last_milestone_count';
const RANK_KEY = 'vr_last_milestone_rank';

export type MilestoneKind = 'first_referral' | 'referral' | 'prize_threshold' | 'rank_top3' | 'rank_one';

export interface MilestoneEvent {
  kind: MilestoneKind;
  message: string;
  confettiColors: string[];
  particleCount: number;
}

const REFERRAL_MILESTONES = [1, 3, 5, 10] as const;

/** Detect milestone crossed since last stored count/rank. */
export function detectMilestones(
  prevCount: number,
  nextCount: number,
  prevRank: number | null,
  nextRank: number | null,
): MilestoneEvent[] {
  const events: MilestoneEvent[] = [];

  for (const m of REFERRAL_MILESTONES) {
    if (prevCount < m && nextCount >= m) {
      if (m === 1) {
        events.push({
          kind: 'first_referral',
          message: 'First referral — you are on the board!',
          confettiColors: ['#34d399', '#6ee7b7', '#a78bfa'],
          particleCount: 80,
        });
      } else if (m === 10) {
        events.push({
          kind: 'prize_threshold',
          message: '10 referrals — prize threshold reached!',
          confettiColors: ['#fbbf24', '#f59e0b', '#34d399'],
          particleCount: 120,
        });
      } else {
        events.push({
          kind: 'referral',
          message: `${m} referrals — keep climbing!`,
          confettiColors: ['#34d399', '#a78bfa', '#f472b6'],
          particleCount: 60,
        });
      }
    }
  }

  if (nextRank === 1 && prevRank !== 1) {
    events.push({
      kind: 'rank_one',
      message: 'You are #1 on the leaderboard!',
      confettiColors: ['#fbbf24', '#f59e0b', '#fde68a'],
      particleCount: 150,
    });
  } else if (
    nextRank != null &&
    nextRank <= 3 &&
    (prevRank == null || prevRank > 3)
  ) {
    events.push({
      kind: 'rank_top3',
      message: `Top 3 — you are #${nextRank}!`,
      confettiColors: ['#34d399', '#a78bfa', '#fbbf24'],
      particleCount: 90,
    });
  }

  return events;
}

function readStoredInt(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null || raw === '') return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredInt(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // non-fatal
  }
}

export function getStoredMilestoneBaseline(): { count: number; rank: number | null } {
  return {
    count: readStoredInt(COUNT_KEY) ?? 0,
    rank: readStoredInt(RANK_KEY),
  };
}

export function storeMilestoneBaseline(count: number, rank: number | null): void {
  writeStoredInt(COUNT_KEY, count);
  if (rank != null && rank >= 1) writeStoredInt(RANK_KEY, rank);
}

function fireConfetti(colors: string[], particleCount: number): void {
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      confetti({
        particleCount,
        spread: 72,
        origin: { y: 0.65 },
        colors,
      });
    })
    .catch(() => {});
}

const SEEDED_KEY = 'vr_milestone_seeded';

/** Celebrate milestones if count/rank improved since last baseline (skips initial page load). */
export function celebrateMilestonesIfAny(count: number, rank: number | null): void {
  let seeded = false;
  try {
    seeded = sessionStorage.getItem(SEEDED_KEY) === '1';
  } catch {
    seeded = false;
  }

  const baseline = getStoredMilestoneBaseline();
  if (!seeded) {
    storeMilestoneBaseline(count, rank);
    try {
      sessionStorage.setItem(SEEDED_KEY, '1');
    } catch {
      // non-fatal
    }
    return;
  }

  const events = detectMilestones(baseline.count, count, baseline.rank, rank);
  storeMilestoneBaseline(count, rank);

  if (!events.length) return;

  for (const event of events) {
    showToast(event.message, 'success');
    fireConfetti(event.confettiColors, event.particleCount);
  }
}