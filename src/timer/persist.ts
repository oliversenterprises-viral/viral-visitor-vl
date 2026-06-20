/**
 * Elite Timer Persistence (localStorage)
 * Versioned, small payload, graceful degradation.
 * Key chosen to not collide with existing ViralRefer keys.
 */
import type { PersistedTimerState, TimerState } from './types';

const STORAGE_KEY = 'vr_timer_state_v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 48; // 48h safety

export function saveState(state: TimerState): void {
  try {
    const payload: PersistedTimerState = {
      version: 1,
      targetWallMs: state.targetWallMs,
      durationMs: state.durationMs,
      label: state.label || '',
      finishMessage: state.finishMessage || '',
      soundKey: state.soundKey,
      repeatSound: !!state.repeatSound,
      onZeroAction: state.onZeroAction,
      baseElapsedMs: state.baseElapsedMs || 0,
      lastStatus: state.status,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // Quota / private mode — silent graceful (timer still works in-memory this session)
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.warn('[timer] persist save failed', e);
  }
}

export function loadState(): PersistedTimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedTimerState;
    if (p.version !== 1 || !p.savedAt || Date.now() - p.savedAt > MAX_AGE_MS) {
      clearState();
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearState(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Hydrate a fresh TimerState from persisted + current wall time.
 * Returns null if no valid active persisted timer.
 */
export function hydrateFromPersisted(): Partial<TimerState> | null {
  const p = loadState();
  if (!p || !p.targetWallMs) return null;

  // Re-clamp user strings on load (defense-in-depth vs manual localStorage tampering / poisoning)
  const safeLabel = (p.label || '').slice(0, 80);
  const safeMsg = (p.finishMessage || '').slice(0, 200);

  const now = Date.now();
  if (p.targetWallMs <= now) {
    // Already finished on recovery
    return {
      status: 'FINISHED',
      targetWallMs: p.targetWallMs,
      durationMs: p.durationMs,
      label: safeLabel,
      finishMessage: safeMsg,
      soundKey: p.soundKey,
      repeatSound: p.repeatSound,
      onZeroAction: p.onZeroAction,
      baseElapsedMs: p.baseElapsedMs || p.durationMs,
      remainingMs: 0,
      elapsedMs: p.durationMs,
    };
  }

  const remaining = Math.max(0, p.targetWallMs - now);
  const elapsed = Math.max(0, p.durationMs - remaining);

  return {
    status: (p.lastStatus === 'RUNNING' || p.lastStatus === 'PAUSED') ? p.lastStatus : 'PAUSED',
    targetWallMs: p.targetWallMs,
    durationMs: p.durationMs,
    label: safeLabel,
    finishMessage: safeMsg,
    soundKey: p.soundKey,
    repeatSound: p.repeatSound,
    onZeroAction: p.onZeroAction,
    baseElapsedMs: p.baseElapsedMs || elapsed,
    remainingMs: remaining,
    elapsedMs: elapsed,
  };
}
