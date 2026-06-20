/**
 * Elite vClock Replica — Dedicated Web Worker
 * Background-proof timing engine.
 * Uses performance.now() + compensation for drift-free ticks even when tab hidden.
 * Communicates via minimal strict protocol.
 *
 * NOTE: This runs in worker global scope (no DOM, no window).
 */

/// <reference lib="webworker" />

import type { MainToWorker, WorkerToMain } from './types';

let targetWallMs: number | null = null;
let remainingMs = 0;
let baseElapsedMs = 0;
let lastMonotonic = 0;
let tickInterval: number | null = null;
let tickMs = 250; // Tunable: 50-500ms. 250 good balance accuracy / power.

function post(msg: WorkerToMain) {
  (self as any).postMessage(msg);
}

function computeAndPost(_reason: 'tick' | 'sync' | 'init' | 'adjust' = 'tick') {
  const nowMono = performance.now();
  if (lastMonotonic > 0) {
    const delta = nowMono - lastMonotonic;
    if (remainingMs > 0) {
      remainingMs = Math.max(0, remainingMs - delta);
    }
  }
  lastMonotonic = nowMono;

  post({
    type: 'TICK',
    remainingMs: Math.round(Math.max(0, remainingMs)),
    elapsedMs: Math.round(Math.max(0, baseElapsedMs + (targetWallMs ? Math.max(0, (targetWallMs - Date.now()) - remainingMs) : 0))),
    monotonic: nowMono,
  } as WorkerToMain);

  if (remainingMs <= 0 && tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    post({ type: 'FINISHED' });
  }
}

function startLoop() {
  if (tickInterval) clearInterval(tickInterval);
  lastMonotonic = performance.now();

  // Compensation-aware interval (postMessage keeps main in sync)
  tickInterval = setInterval(() => {
    computeAndPost('tick');
  }, tickMs) as unknown as number;
}

function stopLoop() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

// Message protocol handler
self.onmessage = (e: MessageEvent<MainToWorker>) => {
  const data = e.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'INIT': {
      const p = data.payload;
      const MAX_D = 48 * 60 * 60 * 1000;
      targetWallMs = p.targetWallMs ?? null;
      const dur = Math.min(MAX_D, Math.max(0, p.durationMs || 0));
      remainingMs = targetWallMs ? Math.max(0, targetWallMs - Date.now()) : dur;
      baseElapsedMs = p.baseElapsedMs || 0;
      tickMs = Math.min(1000, Math.max(50, p.tickMs || 250)); // clamp to sane range (anti-exhaustion on tampering)
      lastMonotonic = performance.now();
      startLoop();
      computeAndPost('init');
      break;
    }
    case 'START': {
      // If we have a target, just ensure loop; otherwise treat as resume from current remaining
      if (!tickInterval) startLoop();
      computeAndPost('adjust');
      break;
    }
    case 'PAUSE': {
      stopLoop();
      // Snapshot current remaining into base for resume math
      if (targetWallMs) {
        remainingMs = Math.max(0, targetWallMs - Date.now());
      }
      computeAndPost('adjust');
      break;
    }
    case 'RESUME': {
      if (targetWallMs) {
        targetWallMs = Date.now() + remainingMs; // re-anchor target
      }
      lastMonotonic = performance.now();
      startLoop();
      computeAndPost('adjust');
      break;
    }
    case 'RESET': {
      stopLoop();
      remainingMs = 0;
      baseElapsedMs = 0;
      targetWallMs = null;
      post({ type: 'TICK', remainingMs: 0, elapsedMs: 0, monotonic: performance.now() });
      break;
    }
    case 'SYNC_REQUEST': {
      computeAndPost('sync');
      break;
    }
    case 'SET_DURATION': {
      const MAX_D = 48 * 60 * 60 * 1000;
      const total = Math.min(MAX_D, Math.max(0, data.totalMs | 0));
      remainingMs = total;
      baseElapsedMs = 0;
      targetWallMs = total > 0 ? Date.now() + total : null;
      lastMonotonic = performance.now();
      if (!tickInterval && total > 0) {
        // Do not auto-start; caller will START
      }
      computeAndPost('adjust');
      break;
    }
    default:
      // Unknown — ignore for forward compat
      break;
  }
};

// Health / background keep-alive hint (rarely needed)
setInterval(() => {
  if (tickInterval) {
    // Worker is alive; main will request sync on visibility
  }
}, 30000);

// Initial ping so main knows worker is ready (optional)
post({ type: 'PONG', now: performance.now(), remainingMs: 0 });
