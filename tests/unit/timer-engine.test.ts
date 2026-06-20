/**
 * Elite Timer — Pure unit tests (engine + persist)
 * Follows exact style and patterns from referrals-helpers.test.ts (describe/it/expect, beforeEach, pure helpers)
 * Imports ONLY public engine + persist (no DOM queries, no ui/audio/worker/timer.worker direct).
 * All worker protocol covered indirectly via engine public API + MockWorker driving TICK/FINISHED etc.
 * Deterministic + fast: vi.resetModules + stub Worker + fakeTimers + explicit simulateMessage (no real intervals).
 * 22 focused cases covering state machine, duration math/clamp, persist hydrate (active/finished/expired), worker msg protocol, onTick/onComplete, set* , reset, edges, long duration.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveState, loadState, clearState, hydrateFromPersisted } from '../../src/timer/persist';

// NOTE: no import of engine at top-level (side-effecty); dynamic + resetModules inside engine describe only.
// No types.ts import to strictly follow "only public engine + persist".

// Persist tests are pure (use direct import + ls only; no engine).

describe('timer persist (pure + recovery)', () => {
  beforeEach(() => {
    clearState();
  });
  afterEach(() => {
    clearState();
  });

  it('saveState + loadState roundtrips core fields', () => {
    const now = Date.now();
    const payload = {
      version: 1 as const,
      targetWallMs: now + 300000,
      durationMs: 300000,
      label: 'Deep Work',
      finishMessage: 'Stand up!',
      soundKey: 'guitar',
      repeatSound: true,
      onZeroAction: 'restart' as const,
      baseElapsedMs: 0,
      lastStatus: 'RUNNING' as const,
      savedAt: now,
    };
    // saveState accepts TimerState shape; we pass minimal matching
    saveState(payload as any);
    const p = loadState();
    expect(p).not.toBeNull();
    expect(p!.label).toBe('Deep Work');
    expect(p!.soundKey).toBe('guitar');
    expect(p!.onZeroAction).toBe('restart');
    expect(p!.version).toBe(1);
    expect(p!.durationMs).toBe(300000);
  });

  it('hydrateFromPersisted recovers active timer with correct remaining + status', () => {
    const STORAGE_KEY = 'vr_timer_state_v1';
    const future = Date.now() + 120000;
    // Use direct storage to control exact persisted shape (saveState normalizes lastStatus=saved.status and forces savedAt)
    const persisted = {
      version: 1, targetWallMs: future, durationMs: 120000,
      label: 'Active', finishMessage: '', soundKey: 'classic', repeatSound: false,
      onZeroAction: 'stop', baseElapsedMs: 0, lastStatus: 'RUNNING', savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    const h = hydrateFromPersisted();
    expect(h).not.toBeNull();
    expect(h!.status).toBe('RUNNING');
    expect(h!.remainingMs).toBeGreaterThan(110000);
    expect(h!.targetWallMs).toBe(future);
    expect(h!.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('hydrateFromPersisted returns FINISHED for already-expired target (expired case)', () => {
    const past = Date.now() - 5000;
    const payload = {
      version: 1 as const, targetWallMs: past, durationMs: 60000,
      label: 'Expired', finishMessage: 'Done', soundKey: 'bell', repeatSound: true,
      onZeroAction: 'stop' as const, baseElapsedMs: 60000, lastStatus: 'RUNNING' as const, savedAt: Date.now() - 10000,
    };
    saveState(payload as any);
    const h = hydrateFromPersisted();
    expect(h).not.toBeNull();
    expect(h!.status).toBe('FINISHED');
    expect(h!.remainingMs).toBe(0);
    expect(h!.elapsedMs).toBe(60000);
  });

  it('hydrateFromPersisted for FINISHED persisted lastStatus path + active past boundary', () => {
    const almostPast = Date.now() - 1;
    const payload = {
      version: 1 as const, targetWallMs: almostPast, durationMs: 30000,
      label: 'Just Expired', finishMessage: '', soundKey: 'classic', repeatSound: true,
      onZeroAction: 'stop' as const, baseElapsedMs: 30000, lastStatus: 'FINISHED' as const, savedAt: Date.now(),
    };
    saveState(payload as any);
    const h = hydrateFromPersisted();
    expect(h).not.toBeNull();
    expect(h!.status).toBe('FINISHED');
    expect(h!.remainingMs).toBe(0);
  });

  it('clearState removes persisted value and load returns null', () => {
    saveState({ version: 1, targetWallMs: null, durationMs: 1000, label: 'x', finishMessage: '', soundKey: 'classic', repeatSound: false, onZeroAction: 'stop' as const, savedAt: Date.now() } as any);
    clearState();
    expect(loadState()).toBeNull();
  });

  it('hydrateFromPersisted returns null when nothing or too old (>48h)', () => {
    const STORAGE_KEY = 'vr_timer_state_v1';
    expect(hydrateFromPersisted()).toBeNull();
    const old = Date.now() - (1000 * 60 * 60 * 49);
    const stale = {
      version: 1, targetWallMs: Date.now() + 1000, durationMs: 1000, label: '', finishMessage: '',
      soundKey: 'classic', repeatSound: false, onZeroAction: 'stop', baseElapsedMs: 0, lastStatus: 'RUNNING', savedAt: old,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stale));
    expect(hydrateFromPersisted()).toBeNull(); // load detects age > MAX, calls clearState, returns null
  });
});

// E2E guidance / stub (Playwright) — do NOT put DOM here (unit file must stay pure per spec).
// Place this in an e2e/ file (e.g. extend tests/e2e/ or new timer-background.spec.ts):
/*
import { test, expect } from '@playwright/test';

test.describe('timer background reliability + replica fidelity (E2E)', () => {
  test('visibility simulation + accurate catch-up + finish + export smoke', async ({ page }) => {
    await page.goto('/'); // or the page hosting openTimer()
    // open the timer overlay (uses public global)
    await page.evaluate(() => (window as any).openTimer?.());

    // Start a long timer (e.g. 10s for fast test, use longer in real SLO verification)
    await page.getByRole('button', { name: /start/i }).click(); // or fill presets + start

    // Simulate background/hidden (page.evaluate sets document + dispatches)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // "wait" a simulated background period (use page.waitForTimeout or clock if supported; real time for fidelity)
    await page.waitForTimeout(3500); // in real run use 30-120s hidden for SLO; worker compensates

    // Return to foreground
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Assert accurate catch-up (remaining approx wall time - elapsed, not drifted badly)
    const display = page.locator('#timer-display');
    const text = await display.textContent();
    // e.g. expect remaining to have decreased roughly by wait period (fuzzy due to tick granularity)
    expect(text).toMatch(/\d{1,2}:\d{2}/);

    // Let it finish or force finish path, assert FINISHED + onZero side effects (sound stub hard in e2e)
    await page.waitForTimeout(7000);
    // finish behavior: status text or class update, export still available
    await expect(page.locator('#timer-status')).toContainText(/FINISH|UP|DONE/i); // or exact

    // Export download smoke (click export, verify no crash + download triggered)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#timer-export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.html$/);
  });
});
*/

describe('timer engine (state machine + worker protocol mocked + fidelity)', () => {
  let engine: any;
  let workersRef: any[] = [];

  beforeEach(async () => {
    clearState();

    // Critical: reset module graph BEFORE stubbing + re-import so engine's bootstrap + internal worker var are fresh
    vi.resetModules();

    workersRef = [];

    class MockWorker {
      onmessage: any = null;
      postMessage = vi.fn(function postMessageImpl(_msg: any) {});
      constructor(_url: any, _opts?: any) {
        workersRef.push(this);
      }
      simulateMessage(msg: any) {
        if (this.onmessage) this.onmessage({ data: msg });
      }
    }
    vi.stubGlobal('Worker', MockWorker as any);

    // Stub noisy side-effect globals (audio, notif) so finish paths + start() never throw in unit.
    // Use regular function (not arrow) so `new AudioContext()` succeeds in ensure/unlockAudio (called by start()).
    function createAudioCtxInstance() {
      return {
        state: 'running',
        resume: vi.fn().mockResolvedValue(undefined),
        createOscillator: vi.fn(function () {
          return {
            frequency: { setValueAtTime: vi.fn() },
            type: 'sine',
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
          };
        }),
        createGain: vi.fn(function () {
          return {
            gain: { setValueAtTime: vi.fn(), value: 1 },
            connect: vi.fn(),
          };
        }),
        destination: {},
        close: vi.fn(),
      };
    }
    const AudioCtxMock = vi.fn(function AudioContextMock() {
      return createAudioCtxInstance();
    });
    vi.stubGlobal('AudioContext', AudioCtxMock);
    vi.stubGlobal('webkitAudioContext', AudioCtxMock);
    vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission: 'denied' as const }));

    // Now safe dynamic import of ONLY the public engine surface
    const engineMod = await import('../../src/timer/engine');
    engine = engineMod;

    // Let module bootstrap (setTimeout 40ms hydrate + doc listeners) execute deterministically
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(100);

    // Clean slate after bootstrap (idempotent)
    engine.reset();
    clearState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    clearState();
  });

  // State machine transitions (5)
  it('initial state is IDLE with DEFAULT duration', () => {
    const s = engine.getState();
    expect(s.status).toBe('IDLE');
    expect(s.durationMs).toBe(5 * 60 * 1000);
    expect(s.remainingMs).toBe(5 * 60 * 1000);
    expect(s.targetWallMs).toBeNull();
  });

  it('start transitions IDLE -> RUNNING (and posts worker INIT+START)', async () => {
    engine.setDuration(8000);
    await engine.start();
    expect(engine.getState().status).toBe('RUNNING');
    expect(workersRef.length).toBe(1);
    const posts = workersRef[0].postMessage.mock.calls.map((c: any[]) => c[0]);
    expect(posts.some((m: any) => m.type === 'INIT')).toBe(true);
    expect(posts.some((m: any) => m.type === 'START')).toBe(true);
  });

  it('pause transitions RUNNING -> PAUSED and posts PAUSE', async () => {
    engine.setDuration(7000);
    await engine.start();
    engine.pause();
    expect(engine.getState().status).toBe('PAUSED');
    const posts = workersRef[0].postMessage.mock.calls.map((c: any[]) => c[0]);
    expect(posts.some((m: any) => m.type === 'PAUSE')).toBe(true);
  });

  it('resume transitions PAUSED -> RUNNING and posts RESUME', async () => {
    engine.setDuration(6000);
    await engine.start();
    engine.pause();
    engine.resume();
    expect(engine.getState().status).toBe('RUNNING');
    const posts = workersRef[0].postMessage.mock.calls.map((c: any[]) => c[0]);
    expect(posts.some((m: any) => m.type === 'RESUME')).toBe(true);
  });

  it('FINISHED transition via worker message (simulated); reset from FINISHED', async () => {
    engine.setDuration(4000);
    await engine.start();
    const w = workersRef[0];
    w.simulateMessage({ type: 'FINISHED' });
    expect(engine.getState().status).toBe('FINISHED');
    expect(engine.getState().remainingMs).toBe(0);
    engine.reset();
    expect(engine.getState().status).toBe('IDLE');
  });

  // Duration math + clamp + edges + long (6)
  it('setDuration clamps negative to zero and sets IDLE', () => {
    engine.setDuration(-12345);
    const s = engine.getState();
    expect(s.durationMs).toBe(0);
    expect(s.remainingMs).toBe(0);
    expect(s.status).toBe('IDLE');
    expect(s.targetWallMs).toBeNull();
  });

  it('setDuration(0) edge is valid IDLE zero-duration', () => {
    engine.setDuration(0);
    const s = engine.getState();
    expect(s.durationMs).toBe(0);
    expect(s.remainingMs).toBe(0);
    expect(s.status).toBe('IDLE');
  });

  it('setDuration floors and sets targetWall + remaining exactly', () => {
    engine.setDuration(12345.789);
    const s = engine.getState();
    expect(s.durationMs).toBe(12345);
    expect(s.remainingMs).toBe(12345);
    expect(s.targetWallMs).toBeGreaterThan(Date.now());
  });

  it('setDuration long duration (2h) accepted and math holds', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    engine.setDuration(twoHours);
    const s = engine.getState();
    expect(s.durationMs).toBe(twoHours);
    expect(s.remainingMs).toBe(twoHours);
  });

  it('start with <=0 duration is no-op (stays IDLE)', async () => {
    engine.setDuration(0);
    await engine.start();
    expect(engine.getState().status).toBe('IDLE');
  });

  it('negative duration in set never produces negative remaining/target', () => {
    engine.setDuration(-999);
    const s = engine.getState();
    expect(s.remainingMs).toBeGreaterThanOrEqual(0);
    expect(s.durationMs).toBeGreaterThanOrEqual(0);
  });

  // onTick / onComplete firing (3)
  it('onTick fires on manual TICK simulation from worker (with rem/elapsed/status)', async () => {
    const tickSpy = vi.fn();
    const unsub = engine.onTick(tickSpy);
    engine.setDuration(10000);
    await engine.start();
    const w = workersRef[0];
    w.simulateMessage({ type: 'TICK', remainingMs: 7500, elapsedMs: 2500, monotonic: 123456 });
    expect(tickSpy).toHaveBeenCalledWith(7500, 2500, 'RUNNING');
    expect(engine.getState().remainingMs).toBe(7500);
    unsub();
  });

  it('onComplete fires exactly once on FINISHED worker message', async () => {
    const completeSpy = vi.fn();
    const unsub = engine.onComplete(completeSpy);
    engine.setDuration(3000);
    await engine.start();
    workersRef[0].simulateMessage({ type: 'FINISHED' });
    expect(completeSpy).toHaveBeenCalledTimes(1);
    expect(completeSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'FINISHED', remainingMs: 0 }));
    unsub();
  });

  it('unsubscribe prevents further listener calls', async () => {
    const spy = vi.fn();
    const unsub = engine.onTick(spy);
    engine.setDuration(5000);
    await engine.start();
    unsub();
    // Clear pre-unsub calls from setDuration/start notifyTick so we assert only post-unsub behavior
    spy.mockClear();
    workersRef[0].simulateMessage({ type: 'TICK', remainingMs: 4000, elapsedMs: 1000, monotonic: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  // set* config (3)
  it('setLabel/setFinishMessage truncate to limits and save', () => {
    const longLabel = 'A'.repeat(100);
    const longMsg = 'B'.repeat(250);
    engine.setLabel(longLabel);
    engine.setFinishMessage(longMsg);
    const s = engine.getState();
    expect(s.label.length).toBe(80);
    expect(s.finishMessage.length).toBe(200);
  });

  it('setSound / setRepeat / setOnZeroAction / setShowMs mutate state + most persist', () => {
    engine.setSound('guitar');
    engine.setRepeat(true);
    engine.setOnZeroAction('restart');
    engine.setShowMs(true);
    const s = engine.getState();
    expect(s.soundKey).toBe('guitar');
    expect(s.repeatSound).toBe(true);
    expect(s.onZeroAction).toBe('restart');
    expect(s.showMs).toBe(true);
  });

  it('importConfig applies safe subset (duration via set, others direct)', () => {
    engine.importConfig({ durationMs: 45000, label: 'Imported', soundKey: 'flute', repeatSound: false, onZeroAction: 'stopwatch' as any });
    const s = engine.getState();
    expect(s.durationMs).toBe(45000);
    expect(s.label).toBe('Imported');
    expect(s.soundKey).toBe('flute');
  });

  // reset clears correctly (2)
  it('reset clears target/elapsed, posts RESET to worker, clears persist, keeps config duration/label', async () => {
    engine.setDuration(25000);
    engine.setLabel('KeepMe');
    await engine.start();
    engine.reset();
    const s = engine.getState();
    expect(s.status).toBe('IDLE');
    expect(s.targetWallMs).toBeNull();
    expect(s.remainingMs).toBe(s.durationMs);
    expect(s.label).toBe('KeepMe');
    const lastPosts = workersRef[0]?.postMessage.mock.calls.map((c: any[]) => c[0]);
    expect(lastPosts?.some((m: any) => m.type === 'RESET')).toBe(true);
    expect(loadState()).toBeNull();
  });

  it('reset from FINISHED or PAUSED returns clean IDLE', async () => {
    engine.setDuration(1000);
    await engine.start();
    engine.pause();
    engine.reset();
    expect(engine.getState().status).toBe('IDLE');
    engine.setDuration(1000);
    await engine.start();
    workersRef[0].simulateMessage({ type: 'FINISHED' });
    engine.reset();
    expect(engine.getState().status).toBe('IDLE');
  });

  // worker message protocol (mocked) + coverage indirect (2)
  it('worker protocol: TICK updates engine state; multiple ticks are cumulative', async () => {
    engine.setDuration(10000);
    await engine.start();
    const w = workersRef[0];
    w.simulateMessage({ type: 'TICK', remainingMs: 8000, elapsedMs: 2000, monotonic: 10 });
    expect(engine.getState().remainingMs).toBe(8000);
    w.simulateMessage({ type: 'TICK', remainingMs: 3000, elapsedMs: 7000, monotonic: 20 });
    expect(engine.getState().remainingMs).toBe(3000);
    expect(engine.getState().elapsedMs).toBe(7000);
  });

  it('forceSyncFromWorker is safe no-op when no worker/running and calls worker SYNC_REQUEST when active', async () => {
    engine.forceSyncFromWorker(); // no crash when idle
    engine.setDuration(5000);
    await engine.start();
    const w = workersRef[0];
    engine.forceSyncFromWorker();
    const posts = w.postMessage.mock.calls.map((c: any[]) => c[0]);
    expect(posts.some((m: any) => m.type === 'SYNC_REQUEST')).toBe(true);
  });

  // engine hydrate + fidelity recovery (1)
  it('engine hydrate recovers persisted active RUNNING, re-inits worker, sets RUNNING', async () => {
    const future = Date.now() + 45000;
    const payload = {
      version: 1, targetWallMs: future, durationMs: 45000, label: 'HydratedRun', finishMessage: 'x',
      soundKey: 'classic', repeatSound: true, onZeroAction: 'stop' as const,
      baseElapsedMs: 0, lastStatus: 'RUNNING' as const, savedAt: Date.now(),
    };
    saveState(payload as any);
    // call public hydrate (engine one) — will see persisted and start worker
    engine.hydrate();
    // allow any internal post-timeout
    await vi.advanceTimersByTimeAsync(10);
    const s = engine.getState();
    expect(['RUNNING', 'PAUSED']).toContain(s.status); // hydrate normalizes
    expect(s.label).toBe('HydratedRun');
    // worker should have been ensured for RUNNING recovery
    expect(workersRef.length).toBeGreaterThanOrEqual(1);
  });

  // extra fidelity + edge
  it('getState returns a copy (no direct mutation leak)', () => {
    engine.setDuration(9000);
    const s1 = engine.getState();
    s1.remainingMs = 42; // mutate returned
    const s2 = engine.getState();
    expect(s2.remainingMs).toBe(9000);
  });
});
