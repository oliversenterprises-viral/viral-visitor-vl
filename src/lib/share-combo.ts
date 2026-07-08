/**
 * Share combo — rapid shares within a window stack a visible multiplier.
 */

const COMBO_KEY = 'vr_share_combo';
const COMBO_WINDOW_MS = 5 * 60 * 1000;

interface ComboState {
  count: number;
  lastAt: number;
}

function readState(): ComboState {
  try {
    const raw = localStorage.getItem(COMBO_KEY);
    if (!raw) return { count: 0, lastAt: 0 };
    const parsed = JSON.parse(raw) as ComboState;
    if (typeof parsed.count !== 'number' || typeof parsed.lastAt !== 'number') {
      return { count: 0, lastAt: 0 };
    }
    return parsed;
  } catch {
    return { count: 0, lastAt: 0 };
  }
}

function writeState(state: ComboState): void {
  try {
    localStorage.setItem(COMBO_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal */
  }
}

export function getShareComboCount(): number {
  const state = readState();
  if (!state.lastAt || Date.now() - state.lastAt > COMBO_WINDOW_MS) return 0;
  return state.count;
}

export function shareComboLabel(combo: number): string {
  if (combo >= 5) return `${combo}x COMBO — referral machine!`;
  if (combo >= 3) return `${combo}x combo — on fire!`;
  if (combo === 2) return '2x combo — keep going!';
  return '';
}

/** Record a share; returns combo count and display label. */
export function recordShareCombo(now = Date.now()): { combo: number; label: string } {
  const prev = readState();
  const withinWindow = prev.lastAt && now - prev.lastAt <= COMBO_WINDOW_MS;
  const combo = withinWindow ? prev.count + 1 : 1;
  writeState({ count: combo, lastAt: now });

  if (combo >= 5) return { combo, label: `${combo}x COMBO — referral machine!` };
  if (combo >= 3) return { combo, label: `${combo}x combo — on fire!` };
  if (combo === 2) return { combo, label: '2x combo — keep going!' };
  return { combo, label: '' };
}