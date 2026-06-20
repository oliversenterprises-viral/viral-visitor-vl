/**
 * Elite TimerEngine — Single source of truth for state machine + worker coordination.
 * Background-proof, recoverable, observable.
 * All side effects (persist, audio, notif) coordinated here.
 */

import type {
  TimerState, TimerStatus, OnZeroAction, MainToWorker, WorkerToMain,
} from './types';
import { DEFAULT_STATE } from './types';
import { saveState, hydrateFromPersisted, clearState } from './persist';
import { playFinishSequence, stopAlarm, unlockAudioOnGesture, playTestBeep } from './audio';
// escapeHtml available for future display hardening in UI layer if needed.

export type TickListener = (remainingMs: number, elapsedMs: number, status: TimerStatus) => void;
export type CompleteListener = (state: TimerState) => void;
export type StatusListener = (status: TimerStatus) => void;

let worker: Worker | null = null;
let currentState: TimerState = { ...DEFAULT_STATE };
let tickListeners: TickListener[] = [];
let completeListeners: CompleteListener[] = [];
let statusListeners: StatusListener[] = [];
let alarmPlaying = false;
let wakeLock: any = null; // WakeLockSentinel | null

// --- Worker bootstrap (Vite ?worker aware + blob fallback for export) ---
function createWorker(): Worker {
  // Preferred: Vite will handle new URL(..., import.meta.url) + ?worker in bundling.
  // For runtime in dev + prod bundle we use dynamic.
  // The embed generator will use a Blob version of the exact same logic.
  try {
    const w = new Worker(new URL('./timer.worker.ts', import.meta.url), { type: 'module' });
    return w;
  } catch {
    // Fallback for certain build or standalone contexts — will be overridden by embed blob
    // In normal app this should not hit.
    throw new Error('Timer worker failed to instantiate (check bundler support)');
  }
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = createWorker();
    worker.onmessage = handleWorkerMessage;
    // Give it a moment then ping
    setTimeout(() => worker?.postMessage({ type: 'SYNC_REQUEST' } as MainToWorker), 30);
  }
  return worker;
}

function handleWorkerMessage(e: MessageEvent<WorkerToMain>) {
  const msg = e.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'TICK') {
    currentState.remainingMs = Math.max(0, msg.remainingMs);
    currentState.elapsedMs = Math.max(0, msg.elapsedMs || (currentState.durationMs - currentState.remainingMs));

    // If we were counting to wall time and it hit zero from worker
    if (currentState.remainingMs === 0 && currentState.status === 'RUNNING') {
      transitionToFinished();
    } else {
      notifyTick();
      // Opportunistic persist every ~4s while running
      if (currentState.status === 'RUNNING' && Math.random() < 0.12) {
        saveState(currentState);
      }
    }
  } else if (msg.type === 'FINISHED') {
    if (currentState.status !== 'FINISHED') {
      currentState.remainingMs = 0;
      transitionToFinished();
    }
  } else if (msg.type === 'PONG') {
    // Worker healthy
  }
}

function notifyTick() {
  const { remainingMs, elapsedMs, status } = currentState;
  tickListeners.forEach(fn => fn(remainingMs, elapsedMs, status));
}

function notifyStatus(s: TimerStatus) {
  statusListeners.forEach(fn => fn(s));
}

function notifyComplete() {
  completeListeners.forEach(fn => fn({ ...currentState }));
}

function transitionToFinished() {
  stopWorkerLoop();
  currentState.status = 'FINISHED';
  currentState.remainingMs = 0;

  saveState(currentState); // final snapshot
  notifyStatus('FINISHED');
  notifyComplete();

  // Fire the finish experience (audio + notif + onZero behavior handled by caller via listener)
  triggerFinishSideEffects();
}

async function triggerFinishSideEffects() {
  if (alarmPlaying) return;
  alarmPlaying = true;

  const { label, finishMessage, soundKey, repeatSound } = currentState; // onZeroAction handled by UI listener

  // 1. Visual + toast (main thread will show nice overlay via listener)
  // 2. Notification if hidden (best for background alarm)
  try {
    if (document.hidden && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(label || 'Timer', {
          body: finishMessage || 'Time is up!',
          tag: 'vr-timer-finish',
          requireInteraction: true,
        });
      } else if (Notification.permission !== 'denied') {
        // Ask once on finish path (user is likely at device)
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            new Notification(label || 'Timer', { body: finishMessage || 'Time is up!', requireInteraction: true });
          }
        });
      }
    }
  } catch { /* notifications blocked or unsupported */ }

  // 3. Audio (best effort, user-gesture should have unlocked)
  try {
    await playFinishSequence(soundKey, repeatSound, () => { alarmPlaying = false; });
  } catch {
    alarmPlaying = false;
  }

  // 4. On-zero behavior (executed by UI layer listening to complete)
  //    Engine only signals; UI decides stop / restart loop / switch stopwatch mode.
  void 0; // explicit no-op block
}

function stopWorkerLoop() {
  if (worker) {
    try { worker.postMessage({ type: 'RESET' } as MainToWorker); } catch { /* worker may be gone */ }
    // Do not terminate here — we reuse the worker for next timer.
  }
}

function postToWorker(msg: MainToWorker) {
  const w = ensureWorker();
  w.postMessage(msg);
}

// --- Public API ---

export function getState(): TimerState {
  return { ...currentState };
}

export function onTick(fn: TickListener) { tickListeners.push(fn); return () => { tickListeners = tickListeners.filter(f => f !== fn); }; }
export function onComplete(fn: CompleteListener) { completeListeners.push(fn); return () => { completeListeners = completeListeners.filter(f => f !== fn); }; }
export function onStatus(fn: StatusListener) { statusListeners.push(fn); return () => { statusListeners = statusListeners.filter(f => f !== fn); }; }

export function setDuration(totalMs: number) {
  // Hard upper bound (48h) to limit background worker resource use / exhaustion even on malicious or accidental long values.
  const MAX_DURATION = 48 * 60 * 60 * 1000;
  const clamped = Math.min(MAX_DURATION, Math.max(0, Math.floor(totalMs)));
  currentState.durationMs = clamped;
  currentState.remainingMs = clamped;
  currentState.baseElapsedMs = 0;
  currentState.targetWallMs = clamped > 0 ? Date.now() + clamped : null;
  currentState.status = 'IDLE';
  currentState.elapsedMs = 0;

  postToWorker({ type: 'SET_DURATION', totalMs: clamped });
  saveState(currentState);
  notifyTick();
  notifyStatus('IDLE');
}

export function setLabel(text: string) {
  currentState.label = (text || '').slice(0, 80);
  saveState(currentState);
}

export function setFinishMessage(text: string) {
  currentState.finishMessage = (text || '').slice(0, 200);
  saveState(currentState);
}

export function setSound(key: string) {
  currentState.soundKey = key;
  saveState(currentState);
}

export function setRepeat(v: boolean) {
  currentState.repeatSound = !!v;
  saveState(currentState);
}

export function setOnZeroAction(action: OnZeroAction) {
  currentState.onZeroAction = action;
  saveState(currentState);
}

export function setShowMs(v: boolean) {
  currentState.showMs = !!v;
}

export async function start() {
  // Ensure audio unlocked on explicit user gesture
  await unlockAudioOnGesture();

  if (currentState.status === 'FINISHED') {
    // Auto restart same duration if finished
    setDuration(currentState.durationMs);
  }

  const dur = currentState.remainingMs || currentState.durationMs;
  if (dur <= 0) return;

  currentState.targetWallMs = Date.now() + dur;
  currentState.status = 'RUNNING';
  currentState.baseElapsedMs = currentState.elapsedMs || 0;

  postToWorker({ type: 'INIT', payload: {
    targetWallMs: currentState.targetWallMs,
    durationMs: dur,
    baseElapsedMs: currentState.baseElapsedMs,
    tickMs: 250,
  }});
  postToWorker({ type: 'START' });

  saveState(currentState);
  notifyStatus('RUNNING');
  notifyTick();

  // Optional: request screen wake lock while actively counting (user benefit)
  requestWakeLockIfPossible();
}

export function pause() {
  if (currentState.status !== 'RUNNING') return;
  currentState.status = 'PAUSED';
  postToWorker({ type: 'PAUSE' });
  // Snapshot accurate remaining
  currentState.remainingMs = Math.max(0, currentState.targetWallMs ? (currentState.targetWallMs - Date.now()) : currentState.remainingMs);
  saveState(currentState);
  notifyStatus('PAUSED');
  notifyTick();
  releaseWakeLock();
}

export function resume() {
  if (currentState.status !== 'PAUSED') return;
  // Re-anchor target
  const rem = currentState.remainingMs || currentState.durationMs;
  currentState.targetWallMs = Date.now() + rem;
  currentState.status = 'RUNNING';

  postToWorker({ type: 'INIT', payload: { targetWallMs: currentState.targetWallMs, durationMs: rem, baseElapsedMs: currentState.baseElapsedMs } });
  postToWorker({ type: 'RESUME' });

  saveState(currentState);
  notifyStatus('RUNNING');
  notifyTick();
  requestWakeLockIfPossible();
}

export function reset() {
  stopAlarm();
  alarmPlaying = false;
  currentState = {
    ...DEFAULT_STATE,
    durationMs: currentState.durationMs, // keep last used duration for convenience
    label: currentState.label,
    finishMessage: currentState.finishMessage,
    soundKey: currentState.soundKey,
    repeatSound: currentState.repeatSound,
    onZeroAction: currentState.onZeroAction,
    showMs: currentState.showMs,
  };
  currentState.remainingMs = currentState.durationMs;
  currentState.targetWallMs = null;

  postToWorker({ type: 'RESET' });
  clearState();
  releaseWakeLock();

  notifyTick();
  notifyStatus('IDLE');
}

export function toggleMs() {
  currentState.showMs = !currentState.showMs;
}

export async function testSound() {
  await unlockAudioOnGesture();
  playTestBeep(currentState.soundKey);
}

/** Called on app boot / overlay open to recover running/paused timers across reloads/hidden periods */
export function hydrate() {
  const h = hydrateFromPersisted();
  if (!h) {
    currentState = { ...DEFAULT_STATE };
    return;
  }
  const MAX_D = 48 * 60 * 60 * 1000;
  const hDur = Math.min(MAX_D, Math.max(0, h.durationMs || 0));
  currentState = {
    ...currentState,
    ...h,
    durationMs: hDur,
    remainingMs: Math.min(h.remainingMs ?? hDur, hDur),
  } as TimerState;

  if (currentState.status === 'RUNNING' && currentState.targetWallMs) {
    // Re-create worker and continue
    const w = ensureWorker();
    w.postMessage({ type: 'INIT', payload: {
      targetWallMs: currentState.targetWallMs,
      durationMs: currentState.durationMs,
      baseElapsedMs: currentState.baseElapsedMs,
    }} as MainToWorker);
    w.postMessage({ type: 'START' } as MainToWorker);
    notifyStatus('RUNNING');
    requestWakeLockIfPossible();
  } else if (currentState.status === 'PAUSED') {
    notifyStatus('PAUSED');
  } else if (currentState.status === 'FINISHED') {
    notifyStatus('FINISHED');
  }
  notifyTick();
}

/** Visibility / focus recovery — forces accurate sync from worker */
export function forceSyncFromWorker() {
  if (worker && (currentState.status === 'RUNNING' || currentState.status === 'PAUSED')) {
    worker.postMessage({ type: 'SYNC_REQUEST' } as MainToWorker);
  }
  // Also reconcile with wall in case of extreme drift
  if (currentState.targetWallMs && currentState.status === 'RUNNING') {
    const wallRem = Math.max(0, currentState.targetWallMs - Date.now());
    if (Math.abs(wallRem - currentState.remainingMs) > 800) {
      currentState.remainingMs = wallRem;
      notifyTick();
    }
  }
}

async function requestWakeLockIfPossible() {
  try {
    if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      // Release automatically on visibility hidden is good UX
      document.addEventListener('visibilitychange', releaseWakeLock, { once: true });
    }
  } catch { /* not supported or denied — fine */ }
}

function releaseWakeLock() {
  try { wakeLock?.release?.(); } catch { /* ignore release errors */ }
  wakeLock = null;
}

/** For embed generator / deep links: export current config snapshot */
export function exportConfigForEmbed() {
  const s = getState();
  return {
    durationMs: s.durationMs,
    label: s.label,
    finishMessage: s.finishMessage,
    soundKey: s.soundKey,
    repeatSound: s.repeatSound,
    onZeroAction: s.onZeroAction,
    showMs: s.showMs,
  };
}

/** Programmatic set from URL hash or embed restore (safe) */
export function importConfig(cfg: Partial<TimerState>) {
  if (typeof cfg.durationMs === 'number') setDuration(cfg.durationMs);
  if (cfg.label) setLabel(cfg.label);
  if (cfg.finishMessage) setFinishMessage(cfg.finishMessage);
  if (cfg.soundKey) setSound(cfg.soundKey);
  if (typeof cfg.repeatSound === 'boolean') setRepeat(cfg.repeatSound);
  if (cfg.onZeroAction) setOnZeroAction(cfg.onZeroAction);
  if (typeof cfg.showMs === 'boolean') currentState.showMs = cfg.showMs;
}

// Bootstrap side-effect: hydrate once on module load (safe, idempotent)
if (typeof window !== 'undefined') {
  // Delay slightly to allow UI mount
  setTimeout(() => {
    try { hydrate(); } catch { /* storage unavailable */ }
    // Global visibility recovery (cheap)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) forceSyncFromWorker();
    });
    window.addEventListener('focus', forceSyncFromWorker);
    // Page lifecycle for Chrome freeze
    document.addEventListener('resume', forceSyncFromWorker as any);
  }, 40);
}
